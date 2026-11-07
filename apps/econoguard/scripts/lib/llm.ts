// Env config:
//   LLM_PROVIDER=groq|gemini|openai (auto-detected from the provider keys if unset)
//   LLM_BASE_URL, LLM_MODEL, LLM_API_KEY (explicit OpenAI-compatible endpoint override)
//   GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY (provider-specific keys)

export interface LLMConfig {
  provider: string;
  baseUrl: string;
  model: string;
  key: string;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  groq:     { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openai:   { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
};

export function detectProvider(): LLMConfig | null {
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
    return {
      provider: process.env.LLM_PROVIDER || 'custom',
      baseUrl: process.env.LLM_BASE_URL,
      model: process.env.LLM_MODEL || 'default',
      key: process.env.LLM_API_KEY,
    };
  }

  const explicit = process.env.LLM_PROVIDER;
  const pairs: Array<[string, string | undefined]> = [
    ['groq', process.env.GROQ_API_KEY],
    ['gemini', process.env.GEMINI_API_KEY],
    ['openai', process.env.OPENAI_API_KEY],
  ];

  if (explicit) {
    const match = pairs.find(([p]) => p === explicit);
    if (match?.[1]) {
      const defaults = PROVIDER_DEFAULTS[explicit] || { baseUrl: '', model: '' };
      return {
        provider: explicit,
        baseUrl: process.env.LLM_BASE_URL || defaults.baseUrl,
        model: process.env.LLM_MODEL || defaults.model,
        key: match[1],
      };
    }
  }

  for (const [provider, key] of pairs) {
    if (key) {
      const defaults = PROVIDER_DEFAULTS[provider] || { baseUrl: '', model: '' };
      return { provider, baseUrl: defaults.baseUrl, model: defaults.model, key };
    }
  }

  return null;
}

export async function callLLM(system: string, user: string): Promise<string> {
  const config = detectProvider();
  if (!config) throw new Error('No LLM configured. Set GROQ_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, or LLM_API_KEY+LLM_BASE_URL.');

  if (config.provider === 'gemini') {
    return callGemini(system, user, config.key);
  }
  return callOpenAICompatible(system, user, config);
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 30_000;

let sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function setSleep(fn: (ms: number) => Promise<void>): void {
  sleep = fn;
}

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs?: number) {
    super(message);
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  // fetch rejects with TypeError on network failure; AbortSignal.timeout aborts with TimeoutError.
  return err instanceof TypeError || (err as { name?: string } | null)?.name === 'TimeoutError';
}

async function withRetry<T>(fn: () => Promise<T>, retryable: (err: unknown) => boolean = isRetryable): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !retryable(err)) throw err;
      const hinted = err instanceof HttpError ? err.retryAfterMs : undefined;
      const delay = Math.min(hinted ?? BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
      console.warn(`LLM request failed (${err instanceof Error ? err.message.slice(0, 120) : err}); retry ${attempt}/${MAX_ATTEMPTS - 1} in ${delay}ms`);
      await sleep(delay);
    }
  }
}

function callOpenAICompatible(system: string, user: string, config: LLMConfig): Promise<string> {
  return withRetry(async () => {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      throw new HttpError(
        `${config.provider} ${res.status}: ${await res.text()}`,
        res.status,
        parseRetryAfter(res.headers.get('retry-after')),
      );
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${config.provider} returned empty or malformed response (no choices[0].message.content)`);
    return content;
  });
}

async function callGemini(system: string, user: string, key: string): Promise<string> {
  const { GoogleGenerativeAI, GoogleGenerativeAIError, GoogleGenerativeAIFetchError, GoogleGenerativeAIAbortError } =
    await import('@google/generative-ai');
  // The SDK wraps fetch failures in a status-less GoogleGenerativeAIError and converts aborts to
  // GoogleGenerativeAIAbortError (both with name "Error"; the constructor prefixes the message), so the generic check cannot see them.
  const geminiRetryable = (err: unknown): boolean =>
    isRetryable(err) ||
    err instanceof GoogleGenerativeAIAbortError ||
    (err instanceof GoogleGenerativeAIError &&
      !(err instanceof GoogleGenerativeAIFetchError) &&
      /^\[GoogleGenerativeAI Error\]: Error fetching from /.test(err.message));
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: process.env.LLM_MODEL || 'gemini-flash-latest',
    systemInstruction: system,
    generationConfig: { responseMimeType: 'application/json' },
  });
  return withRetry(async () => {
    const r = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: user }] }] },
      { signal: AbortSignal.timeout(60_000) },
    );
    return r.response.text();
  }, geminiRetryable);
}

function stripFence(text: string): string {
  const s = text.trim();
  return s.startsWith('```') ? s.replace(/^```(?:json)?\r?\n?/, '').replace(/\r?\n?```$/, '') : s;
}

export function parseJson(text: string): unknown {
  const s = stripFence(text);
  try {
    return JSON.parse(s);
  } catch (e) {
    // Models sometimes wrap the payload in prose despite JSON mode; fall back to the outermost object/array.
    const open = s.search(/[{[]/);
    if (open !== -1) {
      const close = s.lastIndexOf(s[open] === '{' ? '}' : ']');
      if (close > open) {
        try { return JSON.parse(s.slice(open, close + 1)); } catch { /* reported below */ }
      }
    }
    console.error('JSON parse failed:', e instanceof Error ? e.message : e);
    console.error('Raw text (first 200 chars):', text.slice(0, 200));
    throw new Error('LLM returned invalid JSON');
  }
}

import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
} from '@google/generative-ai';
import { config } from '../lib/config.js';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: TokenUsage;
}

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

let sessionTokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

export function getSessionTokenUsage(): TokenUsage {
  return { ...sessionTokenUsage };
}

export function resetSessionTokenUsage(): void {
  sessionTokenUsage = { inputTokens: 0, outputTokens: 0 };
}

function addUsage(usage: TokenUsage) {
  sessionTokenUsage.inputTokens += usage.inputTokens;
  sessionTokenUsage.outputTokens += usage.outputTokens;
}

// Returns the balanced {...} / [...] span that begins at `start`, or null if it never closes.
function balancedSpan(text: string, start: number): string | null {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// Models still wrap JSON in prose or fences even when asked for JSON, so fall back to scanning for the first parseable object/array.
export function parseLLMJson(text: string): unknown {
  let json = text.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(json);
  } catch (error) {
    for (let i = 0; i < json.length; i++) {
      if (json[i] !== '{' && json[i] !== '[') continue;
      const span = balancedSpan(json, i);
      if (!span) continue;
      try {
        return JSON.parse(span);
      } catch {
        // Not JSON (e.g. brackets in prose); try the next candidate start.
      }
    }
    throw error;
  }
}

// --- Gemini Provider ---

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  geminiClient ??= new GoogleGenerativeAI(config.geminiApiKey);
  return geminiClient;
}

const GEMINI_TIMEOUT_MS = 60_000;

async function callGemini(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const model = getGeminiClient().getGenerativeModel({
    model: config.geminiModel,
    systemInstruction: systemPrompt,
    generationConfig: { responseMimeType: 'application/json' },
  });

  const timeout = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
  try {
    const result = await model.generateContent(userMessage, { signal: timeout });
    const response = result.response;
    const text = response.text();
    const usage: TokenUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
    };

    addUsage(usage);
    return { text, usage };
  } catch (error) {
    // The SDK only maps an 'AbortError' to its abort error; the 'TimeoutError' raised by
    // AbortSignal.timeout is re-wrapped as a generic error, which would then be retried.
    if (timeout.aborted) {
      const timeoutError = new Error(`Gemini request timed out after ${GEMINI_TIMEOUT_MS}ms`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  }
}

// --- Ollama Provider ---

// Ollama's default context window is small and silently truncates the start of the prompt, which drops the system prompt's output-format instructions.
const OLLAMA_NUM_CTX = 8192;

async function callOllama(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt: userMessage,
      system: systemPrompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.3,
        num_predict: 4096,
        num_ctx: OLLAMA_NUM_CTX,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new HttpError(`Ollama responded with ${response.status}: ${await response.text()}`, response.status);
  }

  const data = await response.json() as {
    response: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };

  const usage: TokenUsage = {
    inputTokens: data.prompt_eval_count || 0,
    outputTokens: data.eval_count || 0,
  };

  addUsage(usage);
  return { text: data.response, usage };
}

// --- Retry Logic ---

function isAbortOrTimeout(error: unknown): boolean {
  return (
    error instanceof GoogleGenerativeAIAbortError ||
    (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
  );
}

function httpStatusOf(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status;
  if (error instanceof GoogleGenerativeAIFetchError) return error.status;
  return undefined;
}

function isTransientError(error: unknown): boolean {
  if (isAbortOrTimeout(error)) return false;
  if (
    error instanceof GoogleGenerativeAIResponseError ||
    error instanceof GoogleGenerativeAIRequestInputError
  ) {
    return false;
  }

  const status = httpStatusOf(error);
  if (status !== undefined) return status === 429 || status >= 500;

  return true;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransientError(error)) throw error;
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`  Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

// --- Public API ---

export type LLMProvider = 'gemini' | 'ollama';

// Holds only a successful resolution so an unavailable provider is re-checked on the next call.
let resolvedProvider: LLMProvider | null = null;

async function isOllamaReachable(): Promise<boolean> {
  if (!config.ollamaBaseUrl) return false;
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveProvider(): Promise<LLMProvider | null> {
  if (resolvedProvider) return resolvedProvider;
  if (config.geminiApiKey) {
    resolvedProvider = 'gemini';
  } else if (await isOllamaReachable()) {
    resolvedProvider = 'ollama';
  }
  return resolvedProvider;
}

export async function callLLM(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const provider = await resolveProvider();

  if (!provider) {
    const ollama = config.ollamaBaseUrl
      ? `Ollama unreachable at ${config.ollamaBaseUrl}`
      : 'OLLAMA_BASE_URL unset';
    throw new Error(`No LLM provider available: GEMINI_API_KEY unset and ${ollama}`);
  }

  console.log(`  [LLM] Using provider: ${provider}`);

  return withRetry(() =>
    provider === 'gemini'
      ? callGemini(systemPrompt, userMessage)
      : callOllama(systemPrompt, userMessage),
  );
}

// Must be awaited before isConfigured() so the provider state is current.
export async function ensureProviderReady(): Promise<void> {
  await resolveProvider();
}

export function isConfigured(): boolean {
  return resolvedProvider !== null;
}

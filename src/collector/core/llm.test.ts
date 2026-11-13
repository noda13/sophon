import { APICallError } from 'ai';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DEFAULT_MODELS, detectProvider, generateStructured, isLlmAvailable } from './llm.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/*';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const schema = z.object({ ok: z.boolean() });

const geminiOk = (text = '{"ok":true}') =>
  HttpResponse.json({
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
  });

const groqOk = (content = '{"ok":true}') =>
  HttpResponse.json({
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: 0,
    model: 'openai/gpt-oss-120b',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function clearLlmEnv() {
  vi.stubEnv('LLM_PROVIDER', '');
  vi.stubEnv('LLM_MODEL', '');
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GROQ_API_KEY', '');
}

beforeEach(() => {
  clearLlmEnv();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('detectProvider', () => {
  it('returns null when no key is set', () => {
    expect(detectProvider()).toBeNull();
    expect(isLlmAvailable()).toBe(false);
  });

  it('treats empty-string keys as unset', () => {
    expect(detectProvider({ GROQ_API_KEY: '', GEMINI_API_KEY: '' })).toBeNull();
  });

  it('detects gemini from GEMINI_API_KEY alone', () => {
    expect(detectProvider({ GEMINI_API_KEY: 'g' })).toEqual({
      provider: 'gemini',
      model: DEFAULT_MODELS.gemini,
      apiKey: 'g',
    });
  });

  it('detects groq from GROQ_API_KEY alone', () => {
    expect(detectProvider({ GROQ_API_KEY: 'q' })).toEqual({
      provider: 'groq',
      model: DEFAULT_MODELS.groq,
      apiKey: 'q',
    });
  });

  it('prefers groq over gemini when both keys are set and LLM_PROVIDER is unset', () => {
    expect(detectProvider({ GROQ_API_KEY: 'q', GEMINI_API_KEY: 'g' })?.provider).toBe('groq');
  });

  it('honors LLM_PROVIDER when its key is present', () => {
    expect(detectProvider({ LLM_PROVIDER: 'gemini', GROQ_API_KEY: 'q', GEMINI_API_KEY: 'g' })?.provider).toBe('gemini');
  });

  it('falls back to an available provider when LLM_PROVIDER names one without a key', () => {
    expect(detectProvider({ LLM_PROVIDER: 'gemini', GROQ_API_KEY: 'q' })?.provider).toBe('groq');
  });

  it('ignores an unknown LLM_PROVIDER', () => {
    expect(detectProvider({ LLM_PROVIDER: 'openai', GEMINI_API_KEY: 'g' })?.provider).toBe('gemini');
  });

  it('overrides the model with LLM_MODEL', () => {
    expect(detectProvider({ GEMINI_API_KEY: 'g', LLM_MODEL: 'gemini-2.5-flash' })?.model).toBe('gemini-2.5-flash');
  });

  it('does not default to the retired gemini-2.0-flash', () => {
    expect(Object.values(DEFAULT_MODELS)).not.toContain('gemini-2.0-flash');
  });
});

describe('generateStructured', () => {
  it('returns null without calling the network when no key is set', async () => {
    const calls = vi.fn();
    server.use(http.all('*', () => { calls(); return new HttpResponse(null, { status: 500 }); }));
    await expect(generateStructured(schema, 'p')).resolves.toBeNull();
    expect(calls).not.toHaveBeenCalled();
  });

  it('parses a gemini response and sends the key, model and system prompt', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gem-key');
    vi.stubEnv('LLM_MODEL', 'gemini-2.5-flash');
    let seen: { url: string; key: string | null; body: unknown } | undefined;
    server.use(http.post(GEMINI_URL, async ({ request }) => {
      seen = { url: request.url, key: request.headers.get('x-goog-api-key'), body: await request.json() };
      return geminiOk();
    }));

    await expect(generateStructured(schema, 'hello', { system: 'be terse' })).resolves.toEqual({ ok: true });
    expect(seen?.url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(seen?.key).toBe('gem-key');
    expect(JSON.stringify(seen?.body)).toContain('be terse');
    expect(JSON.stringify(seen?.body)).toContain('hello');
  });

  it('parses a groq response and sends the bearer key', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    let auth: string | null = null;
    let model: unknown;
    server.use(http.post(GROQ_URL, async ({ request }) => {
      auth = request.headers.get('authorization');
      model = ((await request.json()) as { model: unknown }).model;
      return groqOk();
    }));

    await expect(generateStructured(schema, 'hello')).resolves.toEqual({ ok: true });
    expect(auth).toBe('Bearer groq-key');
    expect(model).toBe(DEFAULT_MODELS.groq);
  });

  it('throws when the response does not match the schema', async () => {
    vi.stubEnv('GROQ_API_KEY', 'k');
    server.use(http.post(GROQ_URL, () => groqOk('{"ok":"yes"}')));
    await expect(generateStructured(schema, 'p')).rejects.toThrow();
  });

  describe('failure diagnostics', () => {
    const KEY = 'gsk_test_secret_value_123';
    const failedGeneration = '{"results":[{"index":0,"summaryJa":"x","category":"ai","importance":3}]}';
    const errorBody = {
      error: {
        message: `Generated JSON does not match the expected schema. See 'failed_generation'. key=${KEY} docs https://console.groq.com/docs/errors`,
        type: 'invalid_request_error',
        code: 'json_validate_failed',
        failed_generation: failedGeneration,
      },
    };
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.stubEnv('GROQ_API_KEY', KEY);
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(http.post(GROQ_URL, () => HttpResponse.json(errorBody, { status: 400 })));
    });

    const logged = () => errorSpy.mock.calls.flat().join('\n');

    it('logs provider, model and the response body on failure', async () => {
      await expect(generateStructured(schema, 'p')).rejects.toThrow();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(logged()).toContain(`groq/${DEFAULT_MODELS.groq}`);
      expect(logged()).toContain('status 400');
      expect(logged()).toContain('json_validate_failed');
      expect(logged()).toContain('failed_generation');
      expect(logged()).toContain('summaryJa');
    });

    it('does not leak the api key or URLs into the log', async () => {
      await expect(generateStructured(schema, 'p')).rejects.toThrow();
      expect(logged()).not.toContain(KEY);
      expect(logged()).not.toMatch(/https?:\/\//);
      expect(logged()).toContain('<url>');
    });

    it('caps each logged part at 2000 characters', async () => {
      server.use(http.post(GROQ_URL, () => new HttpResponse('a'.repeat(5000), { status: 400 })));
      await expect(generateStructured(schema, 'p')).rejects.toThrow();
      for (const part of errorSpy.mock.calls.flat()) expect(String(part).length).toBeLessThanOrEqual(2000);
      expect(logged()).toContain('a'.repeat(1000));
    });

    it('rethrows the original provider error unchanged', async () => {
      const error = await generateStructured(schema, 'p').catch((e: unknown) => e);
      expect(APICallError.isInstance(error)).toBe(true);
      expect((error as APICallError).statusCode).toBe(400);
      expect((error as APICallError).responseBody).toContain('failed_generation');
    });

    it('does not log on success', async () => {
      server.use(http.post(GROQ_URL, () => groqOk()));
      await expect(generateStructured(schema, 'p')).resolves.toEqual({ ok: true });
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    beforeEach(() => vi.stubEnv('GROQ_API_KEY', 'k'));

    it('waits for Retry-After on a 429 instead of the 2s exponential backoff', async () => {
      let calls = 0;
      server.use(http.post(GROQ_URL, () => {
        calls++;
        return calls === 1
          ? new HttpResponse('rate limited', { status: 429, headers: { 'retry-after': '1' } })
          : groqOk();
      }));

      const start = Date.now();
      await expect(generateStructured(schema, 'p')).resolves.toEqual({ ok: true });
      const elapsed = Date.now() - start;
      expect(calls).toBe(2);
      expect(elapsed).toBeGreaterThanOrEqual(950);
      expect(elapsed).toBeLessThan(1900);
    });

    it('retries a 500 and succeeds on a later attempt', async () => {
      let calls = 0;
      server.use(http.post(GROQ_URL, () => {
        calls++;
        return calls < 3
          ? new HttpResponse('boom', { status: 500, headers: { 'retry-after-ms': '10' } })
          : groqOk();
      }));
      await expect(generateStructured(schema, 'p')).resolves.toEqual({ ok: true });
      expect(calls).toBe(3);
    });

    it('gives up after maxAttempts (default 3) on persistent errors', async () => {
      let calls = 0;
      server.use(http.post(GROQ_URL, () => {
        calls++;
        return new HttpResponse('boom', { status: 500, headers: { 'retry-after-ms': '10' } });
      }));
      await expect(generateStructured(schema, 'p')).rejects.toThrow();
      expect(calls).toBe(3);
    });

    it('honors a custom maxAttempts', async () => {
      let calls = 0;
      server.use(http.post(GROQ_URL, () => {
        calls++;
        return new HttpResponse('boom', { status: 500, headers: { 'retry-after-ms': '10' } });
      }));
      await expect(generateStructured(schema, 'p', { maxAttempts: 1 })).rejects.toThrow();
      expect(calls).toBe(1);
    });

    it('does not retry a 400', async () => {
      let calls = 0;
      server.use(http.post(GROQ_URL, () => {
        calls++;
        return new HttpResponse('bad request', { status: 400 });
      }));
      await expect(generateStructured(schema, 'p')).rejects.toThrow();
      expect(calls).toBe(1);
    });

    it('retries a gemini 429 with Retry-After as well', async () => {
      vi.stubEnv('GROQ_API_KEY', '');
      vi.stubEnv('GEMINI_API_KEY', 'g');
      let calls = 0;
      server.use(http.post(GEMINI_URL, () => {
        calls++;
        return calls === 1
          ? HttpResponse.json({ error: { code: 429, message: 'quota', status: 'RESOURCE_EXHAUSTED' } }, { status: 429, headers: { 'retry-after': '1' } })
          : geminiOk();
      }));
      await expect(generateStructured(schema, 'p')).resolves.toEqual({ ok: true });
      expect(calls).toBe(2);
    });

    it('rejects an invalid maxAttempts', async () => {
      await expect(generateStructured(schema, 'p', { maxAttempts: 0 })).rejects.toThrow(RangeError);
    });
  });

  it('aborts when the request exceeds timeoutMs', async () => {
    vi.stubEnv('GROQ_API_KEY', 'k');
    let calls = 0;
    server.use(http.post(GROQ_URL, async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 2000));
      return groqOk();
    }));
    await expect(generateStructured(schema, 'p', { timeoutMs: 100 })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  describe('signal and maxOutputTokens', () => {
    it('forwards maxOutputTokens to the provider request', async () => {
      vi.stubEnv('GROQ_API_KEY', 'k');
      let body: Record<string, unknown> | undefined;
      server.use(http.post(GROQ_URL, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return groqOk();
      }));
      await generateStructured(schema, 'p', { maxOutputTokens: 321 });
      expect(body?.max_tokens).toBe(321);
    });

    it('omits max_tokens when maxOutputTokens is not given', async () => {
      vi.stubEnv('GROQ_API_KEY', 'k');
      let body: Record<string, unknown> | undefined;
      server.use(http.post(GROQ_URL, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return groqOk();
      }));
      await generateStructured(schema, 'p');
      expect(body).not.toHaveProperty('max_tokens');
    });

    it('aborts the in-flight request when the caller signal fires, without retrying', async () => {
      vi.stubEnv('GROQ_API_KEY', 'k');
      const controller = new AbortController();
      let calls = 0;
      server.use(http.post(GROQ_URL, async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 2000));
        return groqOk();
      }));
      setTimeout(() => controller.abort(new Error('stop')), 50);
      await expect(generateStructured(schema, 'p', { signal: controller.signal })).rejects.toThrow();
      expect(calls).toBe(1);
    });

    it('rejects immediately when the signal is already aborted', async () => {
      vi.stubEnv('GROQ_API_KEY', 'k');
      let calls = 0;
      server.use(http.post(GROQ_URL, () => { calls++; return groqOk(); }));
      await expect(generateStructured(schema, 'p', { signal: AbortSignal.abort() })).rejects.toThrow();
      expect(calls).toBe(0);
    });
  });
});

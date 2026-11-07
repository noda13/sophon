import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callLLM, setSleep } from './llm.js';

const okBody = { choices: [{ message: { content: '{"ok":true}' } }] };

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

describe('callLLM retry', () => {
  const sleeps: number[] = [];
  const fetchMock = vi.fn();

  beforeEach(() => {
    sleeps.length = 0;
    fetchMock.mockReset();
    setSleep(async (ms) => { sleeps.push(ms); });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('LLM_BASE_URL', '');
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('retries a 429 and succeeds on the next attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, 'rate limited'))
      .mockResolvedValueOnce(jsonResponse(200, okBody));

    await expect(callLLM('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2000]);
  });

  it('throws the provider error after 3 attempts on persistent 500', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(500, 'boom'));

    await expect(callLLM('sys', 'user')).rejects.toThrow('groq 500: boom');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([2000, 4000]);
  });

  it('does not retry a 400', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, 'bad request'));

    await expect(callLLM('sys', 'user')).rejects.toThrow('groq 400: bad request');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it('honors Retry-After and caps it at 30 seconds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, 'slow down', { 'Retry-After': '7' }))
      .mockResolvedValueOnce(jsonResponse(429, 'slow down', { 'Retry-After': '120' }))
      .mockResolvedValueOnce(jsonResponse(200, okBody));

    await expect(callLLM('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(sleeps).toEqual([7000, 30000]);
  });

  it('retries network errors and timeouts', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(jsonResponse(200, okBody));

    await expect(callLLM('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

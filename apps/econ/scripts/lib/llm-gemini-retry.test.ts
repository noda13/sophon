import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
const getGenerativeModel = vi.fn(() => ({ generateContent }));

vi.mock('@google/generative-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/generative-ai')>();
  return {
    ...actual,
    GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel })),
  };
});

import { GoogleGenerativeAIAbortError, GoogleGenerativeAIError, GoogleGenerativeAIFetchError } from '@google/generative-ai';
import { callLLM, setSleep } from './llm.js';

// SDK の実エラーと同じ形（status: number を持つ）で投げる
function fetchError(status: number, statusText: string): GoogleGenerativeAIFetchError {
  return new GoogleGenerativeAIFetchError(
    `Error fetching from https://example.test: [${status} ${statusText}] msg`,
    status,
    statusText,
  );
}

const okResult = { response: { text: () => '{"ok":true}' } };

describe('callLLM gemini retry', () => {
  const sleeps: number[] = [];

  beforeEach(() => {
    sleeps.length = 0;
    generateContent.mockReset();
    getGenerativeModel.mockClear();
    setSleep(async (ms) => { sleeps.push(ms); });
    vi.stubEnv('LLM_API_KEY', '');
    vi.stubEnv('LLM_BASE_URL', '');
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('retries a 429 and succeeds on the next attempt', async () => {
    generateContent
      .mockRejectedValueOnce(fetchError(429, 'Too Many Requests'))
      .mockResolvedValueOnce(okResult);

    await expect(callLLM('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2000]);
  });

  it('retries a 503 and succeeds on the next attempt', async () => {
    generateContent
      .mockRejectedValueOnce(fetchError(503, 'Service Unavailable'))
      .mockResolvedValueOnce(okResult);

    await expect(callLLM('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400', async () => {
    generateContent.mockRejectedValueOnce(fetchError(400, 'Bad Request'));

    await expect(callLLM('sys', 'user')).rejects.toThrow('[400 Bad Request]');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it('throws the last error after 3 attempts on persistent 500', async () => {
    generateContent.mockImplementation(async () => { throw fetchError(500, 'Internal Server Error'); });

    await expect(callLLM('sys', 'user')).rejects.toThrow('[500 Internal Server Error]');
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([2000, 4000]);
  });

  it('retries a network failure wrapped by the SDK as a status-less GoogleGenerativeAIError', async () => {
    generateContent
      .mockRejectedValueOnce(new GoogleGenerativeAIError('Error fetching from https://example.test: fetch failed'))
      .mockResolvedValueOnce(okResult);

    await expect(callLLM('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2000]);
  });

  it('retries an abort converted by the SDK to GoogleGenerativeAIAbortError', async () => {
    generateContent
      .mockRejectedValueOnce(new GoogleGenerativeAIAbortError('Request aborted when fetching https://example.test: aborted'))
      .mockResolvedValueOnce(okResult);

    await expect(callLLM('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('does not retry a status-less GoogleGenerativeAIError unrelated to fetching', async () => {
    generateContent.mockRejectedValueOnce(new GoogleGenerativeAIError('Failed to parse stream'));

    await expect(callLLM('sys', 'user')).rejects.toThrow('Failed to parse stream');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it('throws after 3 attempts on persistent network failure', async () => {
    generateContent.mockImplementation(async () => {
      throw new GoogleGenerativeAIError('Error fetching from https://example.test: fetch failed');
    });

    await expect(callLLM('sys', 'user')).rejects.toThrow('Error fetching from');
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([2000, 4000]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectProvider, parseJson } from './llm.js';

describe('parseJson', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses plain JSON', () => {
    expect(parseJson('{"a":1,"b":[true,null]}')).toEqual({ a: 1, b: [true, null] });
  });

  it('parses JSON wrapped in a ```json fence', () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in a bare ``` fence', () => {
    expect(parseJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses a fence without newlines around the payload', () => {
    expect(parseJson('```json{"a":1}```')).toEqual({ a: 1 });
  });

  it('parses a fence with CRLF line endings', () => {
    expect(parseJson('```json\r\n{"a":1}\r\n```')).toEqual({ a: 1 });
  });

  it('ignores whitespace around the input and around a fence', () => {
    expect(parseJson('  \n{"a":1}\n  ')).toEqual({ a: 1 });
    expect(parseJson('\n\n```json\n{"a":1}\n```\n\n')).toEqual({ a: 1 });
  });

  it('keeps backticks that are inside JSON strings', () => {
    expect(parseJson('{"a":"```"}')).toEqual({ a: '```' });
  });

  it('extracts the JSON object from surrounding prose', () => {
    expect(parseJson('Here is the result:\n{"a":{"b":1}}\nHope this helps.')).toEqual({ a: { b: 1 } });
  });

  it('extracts a JSON array from surrounding prose', () => {
    expect(parseJson('Sure: [1,2,3] done')).toEqual([1, 2, 3]);
  });

  it('extracts JSON from a fence that follows a preamble', () => {
    expect(parseJson('Result:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('throws a normalised error for invalid JSON and logs the raw text', () => {
    expect(() => parseJson('not json')).toThrow('LLM returned invalid JSON');
    expect(console.error).toHaveBeenCalledWith('Raw text (first 200 chars):', 'not json');
  });

  it('truncates the logged raw text to 200 characters', () => {
    const raw = 'x'.repeat(250);
    expect(() => parseJson(raw)).toThrow('LLM returned invalid JSON');
    expect(console.error).toHaveBeenCalledWith('Raw text (first 200 chars):', 'x'.repeat(200));
  });

  it('throws for empty or whitespace-only input', () => {
    expect(() => parseJson('')).toThrow('LLM returned invalid JSON');
    expect(() => parseJson('   ')).toThrow('LLM returned invalid JSON');
  });

  it('throws for an invalid payload inside a fence', () => {
    expect(() => parseJson('```json\n{"a":\n```')).toThrow('LLM returned invalid JSON');
  });
});

describe('detectProvider', () => {
  const ENV_KEYS = [
    'LLM_API_KEY',
    'LLM_BASE_URL',
    'LLM_PROVIDER',
    'LLM_MODEL',
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
  ];

  beforeEach(() => {
    for (const key of ENV_KEYS) vi.stubEnv(key, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when nothing is configured', () => {
    expect(detectProvider()).toBeNull();
  });

  it('treats empty keys as unset', () => {
    vi.stubEnv('GROQ_API_KEY', '');
    expect(detectProvider()).toBeNull();
  });

  it('prefers an explicit OpenAI-compatible endpoint over every provider key', () => {
    vi.stubEnv('LLM_API_KEY', 'custom-key');
    vi.stubEnv('LLM_BASE_URL', 'https://llm.example.com/v1');
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    expect(detectProvider()).toEqual({
      provider: 'custom',
      baseUrl: 'https://llm.example.com/v1',
      model: 'default',
      key: 'custom-key',
    });
  });

  it('honours LLM_PROVIDER and LLM_MODEL on a custom endpoint', () => {
    vi.stubEnv('LLM_API_KEY', 'custom-key');
    vi.stubEnv('LLM_BASE_URL', 'https://llm.example.com/v1');
    vi.stubEnv('LLM_PROVIDER', 'mine');
    vi.stubEnv('LLM_MODEL', 'big-model');
    expect(detectProvider()).toMatchObject({ provider: 'mine', model: 'big-model' });
  });

  it('ignores LLM_API_KEY when LLM_BASE_URL is missing', () => {
    vi.stubEnv('LLM_API_KEY', 'custom-key');
    expect(detectProvider()).toBeNull();
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    expect(detectProvider()?.provider).toBe('groq');
  });

  it('ignores LLM_BASE_URL when LLM_API_KEY is missing', () => {
    vi.stubEnv('LLM_BASE_URL', 'https://llm.example.com/v1');
    expect(detectProvider()).toBeNull();
  });

  it('uses the Groq defaults for GROQ_API_KEY', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    expect(detectProvider()).toEqual({
      provider: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      key: 'groq-key',
    });
  });

  it('uses the OpenAI defaults for OPENAI_API_KEY', () => {
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    expect(detectProvider()).toEqual({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      key: 'openai-key',
    });
  });

  it('detects Gemini with empty base URL and model so the SDK defaults apply', () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
    expect(detectProvider()).toEqual({ provider: 'gemini', baseUrl: '', model: '', key: 'gemini-key' });
  });

  it('picks groq, then gemini, then openai when several keys are present', () => {
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key');
    expect(detectProvider()?.provider).toBe('gemini');
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    expect(detectProvider()?.provider).toBe('groq');
  });

  it('lets LLM_PROVIDER choose between several available keys', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    vi.stubEnv('LLM_PROVIDER', 'openai');
    expect(detectProvider()).toMatchObject({ provider: 'openai', key: 'openai-key' });
  });

  it('applies LLM_BASE_URL and LLM_MODEL overrides to an explicit provider', () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('LLM_BASE_URL', 'https://proxy.example.com/v1');
    vi.stubEnv('LLM_MODEL', 'other-model');
    expect(detectProvider()).toEqual({
      provider: 'groq',
      baseUrl: 'https://proxy.example.com/v1',
      model: 'other-model',
      key: 'groq-key',
    });
  });

  it('falls back to auto-detection when the explicit provider has no key', () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('GROQ_API_KEY', 'groq-key');
    expect(detectProvider()?.provider).toBe('groq');
  });

  it('falls back to auto-detection when the explicit provider is unknown', () => {
    vi.stubEnv('LLM_PROVIDER', 'mystery');
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');
    expect(detectProvider()?.provider).toBe('openai');
  });
});

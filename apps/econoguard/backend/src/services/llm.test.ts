import { describe, expect, it, vi } from 'vitest';
import { parseLLMJson } from './llm.js';

vi.mock('../lib/config.js', () => ({
  config: {
    geminiApiKey: '',
    geminiModel: 'test-model',
    ollamaBaseUrl: '',
    ollamaModel: 'test-model',
  },
}));

describe('parseLLMJson', () => {
  it('parses plain JSON', () => {
    expect(parseLLMJson('{"a":1,"b":[true,null]}')).toEqual({ a: 1, b: [true, null] });
  });

  it('parses JSON wrapped in a ```json fence', () => {
    expect(parseLLMJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in a bare ``` fence', () => {
    expect(parseLLMJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('recognises the fence language case-insensitively', () => {
    expect(parseLLMJson('```JSON\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses a fence without newlines around the payload', () => {
    expect(parseLLMJson('```json{"a":1}```')).toEqual({ a: 1 });
  });

  it('parses a fence with CRLF line endings', () => {
    expect(parseLLMJson('```json\r\n{"a":1}\r\n```')).toEqual({ a: 1 });
  });

  it('ignores whitespace around plain JSON and around a fence', () => {
    expect(parseLLMJson('  \n{"a":1}\n  ')).toEqual({ a: 1 });
    expect(parseLLMJson('\n\n```json\n{"a":1}\n```\n\n')).toEqual({ a: 1 });
  });

  it('parses a fenced array', () => {
    expect(parseLLMJson('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });

  it('keeps backticks that are inside JSON strings', () => {
    expect(parseLLMJson('{"a":"```"}')).toEqual({ a: '```' });
  });

  it('throws on text that is not JSON', () => {
    expect(() => parseLLMJson('not json')).toThrow(SyntaxError);
  });

  it('throws on empty or whitespace-only input', () => {
    expect(() => parseLLMJson('')).toThrow(SyntaxError);
    expect(() => parseLLMJson('   ')).toThrow(SyntaxError);
  });

  it('throws on invalid JSON inside a fence', () => {
    expect(() => parseLLMJson('```json\n{"a":\n```')).toThrow(SyntaxError);
  });

  it('extracts JSON that follows a leading sentence', () => {
    expect(parseLLMJson('Here is the JSON: {"a":1}')).toEqual({ a: 1 });
  });

  it('extracts JSON followed by trailing commentary', () => {
    expect(parseLLMJson('[{"a":1}]\n\nHope this helps!')).toEqual([{ a: 1 }]);
  });

  it('skips brackets in the prose before the payload', () => {
    expect(parseLLMJson('Note [see below]: result is {"a":[1,2]} done')).toEqual({ a: [1, 2] });
  });

  it('is not confused by braces inside JSON strings', () => {
    expect(parseLLMJson('Result: {"a":"}{\\"x"} end')).toEqual({ a: '}{"x' });
  });

  it('throws when no balanced JSON exists in the text', () => {
    expect(() => parseLLMJson('prefix {"a": [1, 2')).toThrow(SyntaxError);
  });
});

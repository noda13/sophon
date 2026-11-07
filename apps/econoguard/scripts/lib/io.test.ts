import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson, writeJson, writeJsonBatch } from './io.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'econoguard-io-'));
  vi.stubEnv('ECONOGUARD_DATA_DIR', dir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe('readJson', () => {
  it('returns the fallback only when the file does not exist', () => {
    expect(readJson('missing.json', { a: 1 })).toEqual({ a: 1 });
  });

  it('parses an existing file', () => {
    writeFileSync(join(dir, 'x.json'), '[1,2]');
    expect(readJson<number[]>('x.json', [])).toEqual([1, 2]);
  });

  it('throws on corrupt JSON instead of returning the fallback', () => {
    writeFileSync(join(dir, 'x.json'), '{"a":');
    expect(() => readJson('x.json', {})).toThrow('x.json is not valid JSON');
  });

  it('throws on other IO errors such as reading a directory', () => {
    writeFileSync(join(dir, 'file'), '');
    expect(() => readJson('file/child.json', [])).toThrow();
  });

  it('throws when the validator rejects the shape', () => {
    writeFileSync(join(dir, 'x.json'), '[]');
    expect(() => readJson('x.json', {}, v => !Array.isArray(v))).toThrow('unexpected shape');
  });
});

describe('writeJson', () => {
  it('writes pretty-printed JSON and leaves no temp files', () => {
    writeJson('x.json', { a: 1 });
    expect(readFileSync(join(dir, 'x.json'), 'utf-8')).toBe('{\n  "a": 1\n}');
    expect(readdirSync(dir)).toEqual(['x.json']);
  });

  it('replaces an existing file', () => {
    writeJson('x.json', { a: 1 });
    writeJson('x.json', { a: 2 });
    expect(readJson('x.json', null)).toEqual({ a: 2 });
  });
});

describe('writeJsonBatch', () => {
  it('writes every file', () => {
    writeJsonBatch({ 'a.json': [1], 'b.json': [2] });
    expect(readJson('a.json', null)).toEqual([1]);
    expect(readJson('b.json', null)).toEqual([2]);
  });

  it('leaves existing files untouched when serialisation fails part-way', () => {
    writeJson('a.json', 'old');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writeJsonBatch({ 'a.json': 'new', 'b.json': circular })).toThrow();
    expect(readJson('a.json', null)).toBe('old');
    expect(readdirSync(dir)).toEqual(['a.json']);
  });
});

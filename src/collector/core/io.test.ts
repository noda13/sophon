import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { jsonFile, readJson, sourceDir, writeJson, writeJsonBatch } from './io';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sophon-io-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const Num = z.object({ a: z.number() });
const NumList = z.array(z.number());

describe('sourceDir', () => {
  it('resolves data/<source> under the given root', () => {
    expect(sourceDir('econ', '/tmp/root')).toBe('/tmp/root/econ');
  });
});

describe('readJson', () => {
  it('returns the fallback only when the file does not exist', () => {
    expect(readJson(dir, 'missing.json', Num, { a: 1 })).toEqual({ a: 1 });
  });

  it('parses an existing file', () => {
    writeFileSync(join(dir, 'x.json'), '[1,2]');
    expect(readJson(dir, 'x.json', NumList, [])).toEqual([1, 2]);
  });

  it('throws on corrupt JSON instead of returning the fallback', () => {
    writeFileSync(join(dir, 'x.json'), '{"a":');
    expect(() => readJson(dir, 'x.json', Num, { a: 0 })).toThrow('x.json is not valid JSON');
  });

  it('throws on other IO errors such as reading under a file', () => {
    writeFileSync(join(dir, 'file'), '');
    expect(() => readJson(dir, 'file/child.json', NumList, [])).toThrow();
  });

  it('throws when the schema rejects the shape', () => {
    writeFileSync(join(dir, 'x.json'), '[]');
    expect(() => readJson(dir, 'x.json', Num, { a: 0 })).toThrow('x.json has an unexpected shape');
  });

  it('rejects a filename that escapes the directory', () => {
    expect(() => readJson(dir, '../x.json', Num, { a: 0 })).toThrow('escapes the data directory');
  });
});

describe('writeJson', () => {
  it('writes pretty-printed JSON and leaves no temp files', () => {
    writeJson(dir, 'x.json', Num, { a: 1 });
    expect(readFileSync(join(dir, 'x.json'), 'utf-8')).toBe('{\n  "a": 1\n}');
    expect(readdirSync(dir)).toEqual(['x.json']);
  });

  it('creates the directory and nested subdirectories', () => {
    const nested = join(dir, 'data', 'tech');
    writeJson(nested, 'digest/2026-10-01.json', Num, { a: 1 });
    expect(readJson(nested, 'digest/2026-10-01.json', Num, { a: 0 })).toEqual({ a: 1 });
  });

  it('replaces an existing file', () => {
    writeJson(dir, 'x.json', Num, { a: 1 });
    writeJson(dir, 'x.json', Num, { a: 2 });
    expect(readJson(dir, 'x.json', Num, { a: 0 })).toEqual({ a: 2 });
  });

  it('refuses data that does not match the schema and writes nothing', () => {
    expect(() => writeJson(dir, 'x.json', Num, { a: 'nope' } as never)).toThrow('x.json does not match its schema');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('writes the parsed value, so keys outside the schema are not published', () => {
    writeJson(dir, 'x.json', Num, { a: 1, extra: true } as never);
    expect(JSON.parse(readFileSync(join(dir, 'x.json'), 'utf-8'))).toEqual({ a: 1 });
  });

  it('rejects a filename that escapes the directory', () => {
    expect(() => writeJson(dir, '../evil.json', Num, { a: 1 })).toThrow('escapes the data directory');
  });
});

describe('writeJsonBatch', () => {
  it('writes every file', () => {
    writeJsonBatch(dir, { 'a.json': jsonFile(NumList, [1]), 'b.json': jsonFile(NumList, [2]) });
    expect(readJson(dir, 'a.json', NumList, [])).toEqual([1]);
    expect(readJson(dir, 'b.json', NumList, [])).toEqual([2]);
  });

  it('leaves existing files untouched when a later file fails validation', () => {
    writeJson(dir, 'a.json', NumList, [0]);
    expect(() =>
      writeJsonBatch(dir, { 'a.json': jsonFile(NumList, [9]), 'b.json': jsonFile(NumList, ['x'] as never) }),
    ).toThrow('b.json does not match its schema');
    expect(readJson(dir, 'a.json', NumList, [])).toEqual([0]);
    expect(readdirSync(dir)).toEqual(['a.json']);
  });

  it('leaves existing files untouched when serialisation fails part-way', () => {
    writeJson(dir, 'a.json', z.string(), 'old');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() =>
      writeJsonBatch(dir, { 'a.json': jsonFile(z.string(), 'new'), 'b.json': jsonFile(z.any(), circular) }),
    ).toThrow();
    expect(readJson(dir, 'a.json', z.string(), '')).toBe('old');
    expect(readdirSync(dir)).toEqual(['a.json']);
  });
});

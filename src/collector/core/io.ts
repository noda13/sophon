import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import type { z } from 'zod';
import type { SourceId } from '../../shared/schema/meta';

export interface JsonFile<S extends z.ZodType = z.ZodType> {
  schema: S;
  data: z.input<S>;
}

export function jsonFile<S extends z.ZodType>(schema: S, data: z.input<S>): JsonFile<S> {
  return { schema, data };
}

export function sourceDir(source: SourceId, root: string = process.env.SOPHON_DATA_DIR ?? 'data'): string {
  return resolve(root, source);
}

function resolveInside(dir: string, filename: string): string {
  const target = resolve(dir, filename);
  const rel = relative(dir, target);
  if (rel === '' || rel.startsWith('..') || rel.split(sep).includes('..')) {
    throw new Error(`${filename} escapes the data directory`);
  }
  return target;
}

// Only a missing file falls back: swallowing parse/IO errors would let the next write replace
// accumulated history with an empty default.
export function readJson<S extends z.ZodType>(
  dir: string,
  filename: string,
  schema: S,
  fallback: z.output<S>,
): z.output<S> {
  let text: string;
  try {
    text = readFileSync(resolveInside(dir, filename), 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new Error(`${filename} is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`${filename} has an unexpected shape: ${result.error.message}`);
  return result.data;
}

export function writeJson<S extends z.ZodType>(dir: string, filename: string, schema: S, data: z.input<S>): void {
  writeJsonBatch(dir, { [filename]: jsonFile(schema, data) });
}

// Every file is validated and staged before the first rename so a bad shape, a failed
// serialisation or a disk error cannot leave a mix of new and old files.
export function writeJsonBatch(dir: string, files: Record<string, JsonFile>): void {
  const root = resolve(dir);
  const staged: Array<{ tmp: string; target: string }> = [];
  try {
    for (const [filename, { schema, data }] of Object.entries(files)) {
      const target = resolveInside(root, filename);
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new Error(`${filename} does not match its schema: ${parsed.error.message}`);
      mkdirSync(dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      staged.push({ tmp, target });
      writeFileSync(tmp, JSON.stringify(parsed.data, null, 2));
    }
  } catch (e) {
    for (const { tmp } of staged) rmSync(tmp, { force: true });
    throw e;
  }
  for (const { tmp, target } of staged) renameSync(tmp, target);
}

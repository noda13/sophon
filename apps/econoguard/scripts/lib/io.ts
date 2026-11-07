import { writeFileSync, readFileSync, mkdirSync, renameSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(__dirname, '../../frontend/public/data');

function dataDir(): string {
  return process.env.ECONOGUARD_DATA_DIR || DATA_DIR;
}

// Only a missing file falls back: swallowing parse/IO errors would let the next write replace
// accumulated history with an empty default.
export function readJson<T>(filename: string, fallback: T, isValid?: (value: unknown) => boolean): T {
  let text: string;
  try {
    text = readFileSync(resolve(dataDir(), filename), 'utf-8');
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
  if (isValid && !isValid(value)) throw new Error(`${filename} has an unexpected shape`);
  return value as T;
}

export function writeJson(filename: string, data: unknown): void {
  writeJsonBatch({ [filename]: data });
}

// Every temp file is written before the first rename so a failed serialisation or disk error
// cannot leave a mix of new and old files.
export function writeJsonBatch(files: Record<string, unknown>): void {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const staged: Array<{ tmp: string; target: string }> = [];
  try {
    for (const [filename, data] of Object.entries(files)) {
      const target = resolve(dir, filename);
      const tmp = `${target}.${process.pid}.tmp`;
      staged.push({ tmp, target });
      writeFileSync(tmp, JSON.stringify(data, null, 2));
    }
  } catch (e) {
    for (const { tmp } of staged) rmSync(tmp, { force: true });
    throw e;
  }
  for (const { tmp, target } of staged) renameSync(tmp, target);
}

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetaSchema, type Meta, type SourceId } from '../shared/schema/meta';
import { UNFINISHED_RUN_ERROR } from './core/meta';
import type { CollectorSource, RunContext, RunResult, SourceRegistry } from './core/source';
import { resolveSourceIds, resolveTimeoutMs, runSources, DEFAULT_TIMEOUT_MS } from './run-sources';

let root: string;
let lines: string[];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sophon-cli-'));
  lines = [];
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const meta = (id: SourceId): Meta => MetaSchema.parse(JSON.parse(readFileSync(join(root, id, 'meta.json'), 'utf-8')));
const entry =
  (id: SourceId, run: (ctx: RunContext) => Promise<RunResult>) => async (): Promise<CollectorSource> => ({ id, run });
const opts = (extra: object = {}) => ({ root, env: {}, log: (l: string) => lines.push(l), ...extra });

describe('runSources', () => {
  it('records ok and reports counts', async () => {
    const registry: SourceRegistry = { stock: entry('stock', async () => ({ counts: { stocks: 3 }, errors: [] })) };
    const res = await runSources(['stock'], registry, opts());
    expect(res.exitCode).toBe(0);
    expect(res.failedSources).toEqual([]);
    expect(meta('stock').run).toEqual({ status: 'ok', counts: { stocks: 3 }, errors: [] });
    expect(lines).toEqual(['stock: ok stocks=3']);
  });

  it('passes dir, now and env to the source', async () => {
    let seen: RunContext | undefined;
    const registry: SourceRegistry = {
      tech: entry('tech', async (ctx) => {
        seen = ctx;
        return { counts: {}, errors: [] };
      }),
    };
    const now = new Date('2026-01-02T03:04:05Z');
    await runSources(['tech'], registry, opts({ now: () => now, env: { FOO: 'bar' } }));
    expect(seen).toEqual({ dir: join(root, 'tech'), now, env: { FOO: 'bar' } });
  });

  it('isolates a throwing source and keeps going', async () => {
    const registry: SourceRegistry = {
      stock: entry('stock', async () => {
        throw new Error('boom');
      }),
      tech: entry('tech', async () => ({ counts: { digests: 1 }, errors: [] })),
    };
    const res = await runSources(['stock', 'tech'], registry, opts());
    expect(res.exitCode).toBe(1);
    expect(res.failedSources).toEqual(['stock']);
    expect(meta('stock').run).toEqual({ status: 'failed', counts: {}, errors: ['boom'] });
    expect(meta('tech').run.status).toBe('ok');
  });

  it('fails a source whose loader throws', async () => {
    const registry: SourceRegistry = {
      stock: async () => {
        throw new Error('import failed');
      },
    };
    const res = await runSources(['stock'], registry, opts());
    expect(res.failedSources).toEqual(['stock']);
    expect(meta('stock').run.errors).toEqual(['import failed']);
  });

  it('writes meta.json as failed before the source runs', async () => {
    let during: Meta | undefined;
    const registry: SourceRegistry = {
      stock: entry('stock', async () => {
        during = meta('stock');
        return { counts: { stocks: 1 }, errors: [] };
      }),
    };
    await runSources(['stock'], registry, opts());
    expect(during?.run).toEqual({ status: 'failed', counts: {}, errors: [UNFINISHED_RUN_ERROR] });
    expect(meta('stock').run.status).toBe('ok');
  });

  it('marks a source that exceeds the timeout as failed', async () => {
    const registry: SourceRegistry = {
      stock: entry('stock', () => new Promise<RunResult>(() => {})),
      tech: entry('tech', async () => ({ counts: {}, errors: [] })),
    };
    const res = await runSources(['stock', 'tech'], registry, opts({ timeoutMs: 20 }));
    expect(res.failedSources).toEqual(['stock']);
    expect(meta('stock').run.errors[0]).toMatch(/timed out/);
    expect(meta('tech').run.status).toBe('ok');
  });

  it('treats partial as success', async () => {
    const registry: SourceRegistry = {
      issue: entry('issue', async () => ({ counts: { items: 5 }, errors: ['one feed failed'] })),
    };
    const res = await runSources(['issue'], registry, opts());
    expect(res.exitCode).toBe(0);
    expect(res.failedSources).toEqual([]);
    expect(lines).toEqual(['issue: partial items=5']);
  });

  it('exits 1 when a source forces failed despite produced output', async () => {
    const registry: SourceRegistry = {
      tech: entry('tech', async () => ({ counts: { articles: 5 }, errors: ['LLM disabled: no API key'], forceFailed: true })),
    };
    const res = await runSources(['tech'], registry, opts());
    expect(res.exitCode).toBe(1);
    expect(res.failedSources).toEqual(['tech']);
    expect(meta('tech').run.errors).toEqual(['LLM disabled: no API key']);
  });

  it('sanitizes a thrown error with the run env before it reaches meta.json', async () => {
    const registry: SourceRegistry = {
      issue: entry('issue', async () => {
        throw new Error('fetch https://rsshub.internal.example/x failed with key gsk_secretvalue');
      }),
    };
    await runSources(['issue'], registry, opts({ env: { GROQ_API_KEY: 'gsk_secretvalue' } }));
    expect(meta('issue').run.errors).toEqual(['fetch <url> failed with key ***']);
  });

  it('reports an unimplemented source, exits 1 and leaves meta.json alone', async () => {
    const res = await runSources(['econ'], {}, opts());
    expect(res.exitCode).toBe(1);
    expect(res.failedSources).toEqual([]);
    expect(lines).toEqual(['econ: unimplemented']);
    expect(() => meta('econ')).toThrow();
  });

  it('appends failed_sources to GITHUB_OUTPUT', async () => {
    const out = join(root, 'github_output');
    const fail = async (): Promise<RunResult> => {
      throw new Error('x');
    };
    const registry: SourceRegistry = {
      stock: entry('stock', fail),
      tech: entry('tech', fail),
      issue: entry('issue', async () => ({ counts: {}, errors: [] })),
    };
    await runSources(['stock', 'tech', 'issue'], registry, opts({ env: { GITHUB_OUTPUT: out } }));
    expect(readFileSync(out, 'utf-8')).toBe('failed_sources=stock,tech\n');
  });
});

describe('resolveSourceIds', () => {
  it('expands all to every source', () => {
    expect(resolveSourceIds(['all'])).toEqual(['stock', 'tech', 'issue', 'econ']);
  });

  it('deduplicates and keeps order', () => {
    expect(resolveSourceIds(['tech', 'stock', 'tech'])).toEqual(['tech', 'stock']);
  });

  it('returns null for no args or an unknown source', () => {
    expect(resolveSourceIds([])).toBeNull();
    expect(resolveSourceIds(['stock', 'nope'])).toBeNull();
  });
});

describe('resolveTimeoutMs', () => {
  it('reads COLLECT_TIMEOUT_MS and falls back to 15 minutes', () => {
    expect(resolveTimeoutMs({ COLLECT_TIMEOUT_MS: '1000' })).toBe(1000);
    expect(resolveTimeoutMs({})).toBe(DEFAULT_TIMEOUT_MS);
    expect(resolveTimeoutMs({ COLLECT_TIMEOUT_MS: 'abc' })).toBe(DEFAULT_TIMEOUT_MS);
  });
});

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetaSchema, type Meta } from '../../shared/schema/meta';
import { readJson } from './io';
import { UNFINISHED_RUN_ERROR, beginRun, resolveStatus } from './meta';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sophon-meta-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const stored = (): Meta => MetaSchema.parse(readJson(dir, 'meta.json', MetaSchema, null as never));

describe('resolveStatus', () => {
  it('is ok without errors, even when the counts are zero', () => {
    expect(resolveStatus({ items: 0 }, [])).toBe('ok');
    expect(resolveStatus({}, [])).toBe('ok');
  });

  it('is partial when there are errors but output was produced', () => {
    expect(resolveStatus({ articles: 40, failedSources: 2 }, ['RSS failed: a, b'])).toBe('partial');
  });

  it('is failed when there are errors and nothing was produced', () => {
    expect(resolveStatus({ articles: 0 }, ['boom'])).toBe('failed');
    expect(resolveStatus({}, ['boom'])).toBe('failed');
  });

  it('does not count failure counters as output', () => {
    expect(resolveStatus({ failedSources: 3, summariesFailed: 5 }, ['boom'])).toBe('failed');
  });
});

describe('beginRun', () => {
  const at = (iso: string) => () => new Date(iso);

  it('writes a failed meta.json before any work happens', () => {
    beginRun('tech', dir, at('2026-11-07T00:00:00Z'));
    expect(stored()).toEqual({
      source: 'tech',
      generatedAt: '2026-11-07T00:00:00.000Z',
      run: { status: 'failed', counts: {}, errors: [UNFINISHED_RUN_ERROR] },
    });
  });

  it('overwrites the previous run status so a crash does not keep the old ok', () => {
    const first = beginRun('tech', dir);
    first.finish({ articles: 1 }, []);
    expect(stored().run.status).toBe('ok');
    beginRun('tech', dir);
    expect(stored().run.status).toBe('failed');
  });

  it('records an ok run with its counts and finish time', () => {
    let t = Date.parse('2026-11-07T00:00:00Z');
    const run = beginRun('econ', dir, () => new Date((t += 1000)));
    const meta = run.finish({ articles: 12 }, []);
    expect(stored()).toEqual(meta);
    expect(meta).toEqual({
      source: 'econ',
      generatedAt: '2026-11-07T00:00:02.000Z',
      run: { status: 'ok', counts: { articles: 12 }, errors: [] },
    });
  });

  it('records a partial run', () => {
    beginRun('issue', dir).finish({ issues: 30, failedSources: 1 }, ['RSS failed: reuters']);
    expect(stored().run).toEqual({
      status: 'partial',
      counts: { issues: 30, failedSources: 1 },
      errors: ['RSS failed: reuters'],
    });
  });

  it('records a failed run when the caller reports only an error', () => {
    beginRun('stock', dir).finish({}, ['J-Quants returned 401']);
    expect(stored().run.status).toBe('failed');
  });

  it('refuses to finish twice', () => {
    const run = beginRun('tech', dir);
    run.finish({}, []);
    expect(() => run.finish({}, [])).toThrow('already finished');
  });

  it('leaves only meta.json in the directory', () => {
    beginRun('tech', dir).finish({ a: 1 }, []);
    expect(readdirSync(dir)).toEqual(['meta.json']);
  });
});

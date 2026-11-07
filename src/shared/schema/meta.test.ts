import { describe, expect, it } from 'vitest';
import { LegacyMetaSchema, MetaSchema, legacyToMeta } from './meta';
import { readLegacyJson } from './legacy-data.testutil';

describe('meta schema', () => {
  it('accepts the unified shape', () => {
    const meta = { source: 'tech', generatedAt: '2026-01-01T00:00:00.000Z', run: { status: 'ok', counts: { articles: 3 }, errors: [] } };
    expect(MetaSchema.safeParse(meta).success).toBe(true);
    expect(MetaSchema.safeParse({ ...meta, run: { ...meta.run, status: 'weird' } }).success).toBe(false);
  });

  it.each(['stock', 'tech', 'issue', 'econ'] as const)('reads legacy %s meta.json and converts it', (source) => {
    const raw = readLegacyJson(source, 'meta.json');
    const legacy = LegacyMetaSchema.safeParse(raw);
    expect(legacy.success).toBe(true);
    if (!legacy.success) return;
    const converted = legacyToMeta(source, legacy.data);
    expect(converted).not.toBeNull();
    expect(MetaSchema.safeParse(converted).success).toBe(true);
  });

  it('marks a failed econ assessment as failed and failed sources as partial', () => {
    const base = { lastCollectedAt: 'x', lastRun: { sources: { total: 41, failed: [] as string[] }, summaries: { attempted: 0, failed: 0 }, assessment: 'ok' as const } };
    expect(legacyToMeta('econ', base)?.run.status).toBe('ok');
    expect(legacyToMeta('econ', { ...base, lastRun: { ...base.lastRun, assessment: 'failed' } })?.run.status).toBe('failed');
    expect(legacyToMeta('econ', { ...base, lastRun: { ...base.lastRun, sources: { total: 41, failed: ['a'] } } })?.run.status).toBe('partial');
  });
});

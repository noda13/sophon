import { z } from 'zod';

export const SourceIdSchema = z.enum(['stock', 'tech', 'issue', 'econ']);
export type SourceId = z.infer<typeof SourceIdSchema>;

export const RunStatusSchema = z.enum(['ok', 'partial', 'failed']);

export const RunHealthSchema = z.object({
  status: RunStatusSchema,
  counts: z.record(z.string(), z.number()),
  errors: z.array(z.string()),
});

export const MetaSchema = z.object({
  source: SourceIdSchema,
  generatedAt: z.string(),
  run: RunHealthSchema,
});
export type Meta = z.infer<typeof MetaSchema>;

// data ブランチの初期データは旧アプリが書いた meta.json（source ごとに形が違う）を含むため、
// 移行完了までは新旧どちらの形も読めるようにしておく。collector が新形式を書いた時点で不要になる。
const LegacyEconRunSchema = z.object({
  sources: z.object({ total: z.number(), failed: z.array(z.string()) }),
  summaries: z.object({ attempted: z.number(), failed: z.number() }),
  assessment: z.enum(['ok', 'failed', 'skipped']),
});

export const LegacyMetaSchema = z.looseObject({
  // tech / issue / econ
  lastUpdated: z.string().optional(),
  // econ
  lastCollectedAt: z.string().optional(),
  lastRun: LegacyEconRunSchema.optional(),
  // tech
  latestDigestDate: z.string().optional(),
  earliestDigestDate: z.string().optional(),
  // stock
  generatedAt: z.string().optional(),
  provider: z.string().optional(),
  stockCount: z.number().optional(),
});
export type LegacyMeta = z.infer<typeof LegacyMetaSchema>;

export const AnyMetaSchema = z.union([MetaSchema, LegacyMetaSchema]);

export function legacyToMeta(source: SourceId, legacy: LegacyMeta): Meta | null {
  const generatedAt = legacy.lastCollectedAt ?? legacy.lastUpdated ?? legacy.generatedAt;
  if (!generatedAt) return null;

  const counts: Record<string, number> = {};
  const errors: string[] = [];
  let status: Meta['run']['status'] = 'ok';

  if (legacy.stockCount !== undefined) counts.stocks = legacy.stockCount;

  const run = legacy.lastRun;
  if (run) {
    counts.sources = run.sources.total;
    counts.failedSources = run.sources.failed.length;
    counts.summariesAttempted = run.summaries.attempted;
    counts.summariesFailed = run.summaries.failed;
    if (run.sources.failed.length > 0) errors.push(`RSS failed: ${run.sources.failed.join(', ')}`);
    if (run.assessment === 'failed') errors.push('risk assessment failed');
    if (run.assessment === 'failed') status = 'failed';
    else if (errors.length > 0 || run.summaries.failed > 0) status = 'partial';
  }

  return { source, generatedAt, run: { status, counts, errors } };
}

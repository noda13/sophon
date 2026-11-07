export interface RunHealth {
  sources: { total: number; failed: string[] };
  summaries: { attempted: number; failed: number };
  assessment: 'ok' | 'failed' | 'skipped';
}

export interface Meta {
  lastUpdated?: string;
  lastCollectedAt?: string;
  lastRun?: RunHealth;
}

// Fewer than half failing is normal noise from a single bad batch; half or more means summaries are effectively down.
export function getRunWarnings(lastRun: RunHealth | undefined): string[] {
  if (!lastRun) return [];
  const warnings: string[] = [];
  const { sources, summaries, assessment } = lastRun;
  if (sources && sources.failed.length > 0) {
    warnings.push(
      `RSS ${sources.failed.length}/${sources.total} ソースが取得できませんでした: ${sources.failed.join('、')}`,
    );
  }
  if (summaries && summaries.failed > 0 && summaries.failed * 2 >= summaries.attempted) {
    warnings.push('記事の要約に失敗しています');
  }
  if (assessment === 'failed') warnings.push('リスク評価の更新に失敗しました');
  return warnings;
}

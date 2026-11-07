import type { RiskAssessment } from './types.js';

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// One entry per category per UTC day (the latest wins) so history size does not scale with run
// frequency; every key is pruned, including categories the LLM no longer returns.
export function updateRiskHistory(
  history: Record<string, RiskAssessment[]>,
  fresh: RiskAssessment[],
  now: Date,
): Record<string, RiskAssessment[]> {
  const cutoff = now.getTime() - RETENTION_DAYS * DAY_MS;
  const next: Record<string, RiskAssessment[]> = {};
  const categories = new Set([...Object.keys(history), ...fresh.map(r => r.category)]);

  for (const category of categories) {
    const entries = [...(history[category] ?? []), ...fresh.filter(r => r.category === category)];
    const byDay = new Map<string, RiskAssessment>();
    for (const e of entries.sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))) {
      if (new Date(e.assessedAt).getTime() <= cutoff) continue;
      byDay.set(e.assessedAt.slice(0, 10), e);
    }
    if (byDay.size > 0) next[category] = [...byDay.values()];
  }
  return next;
}

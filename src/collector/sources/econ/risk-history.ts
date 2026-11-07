import { RISK_CATEGORIES, type RiskAssessment, type RiskCategory } from '../../../shared/schema/econ';

export type RiskHistory = Partial<Record<RiskCategory, RiskAssessment[]>>;

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// One entry per category per UTC day (the latest wins) so history size does not scale with run
// frequency; every category is pruned, including ones the LLM did not return this time.
export function updateRiskHistory(history: RiskHistory, fresh: readonly RiskAssessment[], now: Date): RiskHistory {
  const cutoff = now.getTime() - RETENTION_DAYS * DAY_MS;
  const next: RiskHistory = {};

  for (const category of RISK_CATEGORIES) {
    const entries = [...(history[category] ?? []), ...fresh.filter((r) => r.category === category)];
    const byDay = new Map<string, RiskAssessment>();
    for (const e of entries.sort((a, b) => a.assessedAt.localeCompare(b.assessedAt))) {
      if (new Date(e.assessedAt).getTime() <= cutoff) continue;
      byDay.set(e.assessedAt.slice(0, 10), e);
    }
    if (byDay.size > 0) next[category] = [...byDay.values()];
  }
  return next;
}

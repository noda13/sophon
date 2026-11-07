import { RISK_CATEGORIES, type CompositeRisk, type RiskAssessment, type RiskCategory } from '../../../shared/schema/econ';

type RiskLevel = CompositeRisk['level'];

export const RISK_WEIGHTS: Record<RiskCategory, number> = {
  currency_finance: 0.3,
  geopolitics_supply_chain: 0.3,
  technology: 0.2,
  social_policy: 0.2,
};

export function scoreToLevel(score: number): RiskLevel {
  if (score <= 20) return 'low';
  if (score <= 40) return 'moderate';
  if (score <= 60) return 'elevated';
  if (score <= 80) return 'high';
  return 'critical';
}

// Returns null unless all categories are present: renormalising the weights over a subset would
// make one category stand in for the whole score.
export function computeComposite(risks: readonly RiskAssessment[], prevCompositeScore: number): CompositeRisk | null {
  const byCategory = new Map<RiskCategory, RiskAssessment>();
  for (const r of risks) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, r);
  }
  if (RISK_CATEGORIES.some((c) => !byCategory.has(c))) return null;

  // Rounded before Math.round so float error in the weighted sum cannot flip a .5 boundary.
  const weighted = RISK_CATEGORIES.reduce((s, c) => s + byCategory.get(c)!.score * RISK_WEIGHTS[c], 0);
  const compositeScore = Math.round(Math.round(weighted * 1e6) / 1e6);
  return {
    compositeScore,
    level: scoreToLevel(compositeScore),
    breakdown: RISK_CATEGORIES.map((c) => ({ category: c, score: byCategory.get(c)!.score, weight: RISK_WEIGHTS[c] })),
    ...(prevCompositeScore > 0 && { delta: compositeScore - prevCompositeScore }),
  };
}

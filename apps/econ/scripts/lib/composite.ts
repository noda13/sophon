import { RISK_CATEGORIES, RISK_WEIGHTS, scoreToLevel, type RiskCategory } from '../../backend/src/schemas/riskConstants.js';
import type { CompositeRisk, RiskAssessment } from './types.js';

// Returns null unless all categories are present: renormalising the weights over a subset would
// make one category stand in for the whole score.
export function computeComposite(risks: RiskAssessment[], prevCompositeScore: number): CompositeRisk | null {
  const byCategory = new Map<RiskCategory, RiskAssessment>();
  for (const r of risks) {
    if (!Object.hasOwn(RISK_WEIGHTS, r.category)) continue;
    const category = r.category as RiskCategory;
    if (!byCategory.has(category)) byCategory.set(category, r);
  }
  if (RISK_CATEGORIES.some(c => !byCategory.has(c))) return null;

  // Rounded before Math.round so float error in the weighted sum cannot flip a .5 boundary.
  const weighted = RISK_CATEGORIES.reduce((s, c) => s + byCategory.get(c)!.score * RISK_WEIGHTS[c], 0);
  const compositeScore = Math.round(Math.round(weighted * 1e6) / 1e6);
  return {
    compositeScore,
    level: scoreToLevel(compositeScore),
    breakdown: RISK_CATEGORIES.map(c => ({ category: c, score: byCategory.get(c)!.score, weight: RISK_WEIGHTS[c] })),
    delta: prevCompositeScore > 0 ? compositeScore - prevCompositeScore : undefined,
  };
}

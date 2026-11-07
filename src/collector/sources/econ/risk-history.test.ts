import { describe, expect, it } from 'vitest';
import type { RiskAssessment, RiskCategory } from '../../../shared/schema/econ';
import { updateRiskHistory } from './risk-history';

const NOW = new Date('2026-11-07T12:00:00.000Z');

function r(category: RiskCategory, assessedAt: string, score = 50): RiskAssessment {
  return { category, score, level: 'elevated', summaryJa: '', factorsJa: [], assessedAt };
}

describe('updateRiskHistory', () => {
  it('appends fresh entries per category', () => {
    const next = updateRiskHistory({ technology: [r('technology', '2026-11-06T00:00:00.000Z')] }, [r('technology', NOW.toISOString())], NOW);
    expect(next.technology).toHaveLength(2);
  });

  it('keeps only the latest entry of a day', () => {
    const history = { technology: [r('technology', '2026-11-07T01:00:00.000Z', 10)] };
    const next = updateRiskHistory(history, [r('technology', '2026-11-07T09:00:00.000Z', 20)], NOW);
    expect(next.technology?.map((e) => e.score)).toEqual([20]);
  });

  it('prunes entries older than 90 days in every category, including ones no longer returned', () => {
    const history = {
      technology: [r('technology', '2026-07-01T00:00:00.000Z'), r('technology', '2026-10-01T00:00:00.000Z')],
      social_policy: [r('social_policy', '2026-06-01T00:00:00.000Z')],
    };
    const next = updateRiskHistory(history, [], NOW);
    expect(next.technology).toHaveLength(1);
    expect(next).not.toHaveProperty('social_policy');
  });

  it('keeps categories independent of each other', () => {
    const next = updateRiskHistory(
      { currency_finance: [r('currency_finance', '2026-11-06T00:00:00.000Z', 10)] },
      [r('technology', NOW.toISOString(), 70)],
      NOW,
    );
    expect(next.currency_finance?.map((e) => e.score)).toEqual([10]);
    expect(next.technology?.map((e) => e.score)).toEqual([70]);
  });

  it('does not mutate its input', () => {
    const history = { technology: [r('technology', '2026-11-06T00:00:00.000Z')] };
    updateRiskHistory(history, [r('technology', NOW.toISOString())], NOW);
    expect(history.technology).toHaveLength(1);
  });
});

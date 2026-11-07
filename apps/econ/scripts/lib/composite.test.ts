import { describe, expect, it } from 'vitest';
import { computeComposite } from './composite.js';
import type { RiskAssessment } from './types.js';

const CATEGORIES = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];

function risk(category: string, score: number): RiskAssessment {
  return { category, score, level: 'low', summaryJa: '', factorsJa: [], assessedAt: '2026-10-24T00:00:00.000Z' };
}

function full(overrides: Record<string, number> = {}, base = 0): RiskAssessment[] {
  return CATEGORIES.map(c => risk(c, overrides[c] ?? base));
}

describe('computeComposite', () => {
  it('weights currency_finance and geopolitics_supply_chain at 0.3 and technology and social_policy at 0.2', () => {
    const result = computeComposite(
      [risk('currency_finance', 10), risk('geopolitics_supply_chain', 20), risk('technology', 30), risk('social_policy', 40)],
      0,
    );
    expect(result?.compositeScore).toBe(23);
    expect(result?.breakdown).toEqual([
      { category: 'currency_finance', score: 10, weight: 0.3 },
      { category: 'geopolitics_supply_chain', score: 20, weight: 0.3 },
      { category: 'technology', score: 30, weight: 0.2 },
      { category: 'social_policy', score: 40, weight: 0.2 },
    ]);
  });

  it('puts the whole weight of one category into the score when the others are zero', () => {
    const only = (category: string) => computeComposite(full({ [category]: 100 }), 0)?.compositeScore;
    expect(only('currency_finance')).toBe(30);
    expect(only('geopolitics_supply_chain')).toBe(30);
    expect(only('technology')).toBe(20);
    expect(only('social_policy')).toBe(20);
  });

  it('returns null instead of renormalising the weights when a category is missing', () => {
    expect(computeComposite([risk('currency_finance', 80), risk('technology', 20)], 0)).toBeNull();
    expect(computeComposite(full().slice(0, 3), 40)).toBeNull();
  });

  it('orders the breakdown by category regardless of the input order', () => {
    const result = computeComposite([...full({ currency_finance: 10 })].reverse(), 0);
    expect(result?.breakdown.map(b => b.category)).toEqual(CATEGORIES);
  });

  it('counts a duplicated category once, keeping the first entry', () => {
    const result = computeComposite([risk('currency_finance', 100), ...full()], 0);
    expect(result?.compositeScore).toBe(30);
    expect(result?.breakdown).toHaveLength(4);
  });

  it('ignores unknown categories in both the score and the breakdown', () => {
    const result = computeComposite([...full({ currency_finance: 40 }), risk('mystery', 100)], 0);
    expect(result?.compositeScore).toBe(12);
    expect(result?.breakdown.map(b => b.category)).toEqual(CATEGORIES);
  });

  it.each(['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf'])(
    'treats the inherited property name %s as an unknown category',
    (name) => {
      const result = computeComposite([...full({ currency_finance: 40 }), risk(name, 100)], 0);
      expect(result?.compositeScore).toBe(12);
      expect(result?.breakdown.map(b => b.category)).toEqual(CATEGORIES);
    },
  );

  it('returns null when every category is an inherited property name or unknown', () => {
    expect(computeComposite([risk('toString', 100), risk('constructor', 100)], 0)).toBeNull();
    expect(computeComposite([risk('mystery', 100)], 0)).toBeNull();
  });

  it('returns null for no risks', () => {
    expect(computeComposite([], 0)).toBeNull();
  });

  it('rounds half up and otherwise to the nearest integer', () => {
    expect(computeComposite(full({ currency_finance: 5 }), 0)?.compositeScore).toBe(2);
    expect(computeComposite(full({ geopolitics_supply_chain: 5 }), 0)?.compositeScore).toBe(2);
    expect(computeComposite(full({ currency_finance: 4 }), 0)?.compositeScore).toBe(1);
    expect(computeComposite(full({ technology: 7 }), 0)?.compositeScore).toBe(1);
  });

  it('derives the level from the rounded score at the 20/21 boundary', () => {
    expect(computeComposite(full({}, 20), 0)?.level).toBe('low');
    expect(computeComposite(full({}, 21), 0)?.level).toBe('moderate');
    expect(computeComposite(full({}, 81), 0)?.level).toBe('critical');
  });

  describe('delta', () => {
    it('is undefined when the previous score is 0', () => {
      expect(computeComposite(full({}, 50), 0)?.delta).toBeUndefined();
    });

    it('is the score difference when the previous score is positive', () => {
      expect(computeComposite(full({}, 50), 40)?.delta).toBe(10);
      expect(computeComposite(full({}, 30), 40)?.delta).toBe(-10);
    });

    it('is 0 rather than undefined when the score is unchanged', () => {
      expect(computeComposite(full({}, 40), 40)?.delta).toBe(0);
    });

    it('is computed from the rounded score', () => {
      const result = computeComposite(full({ currency_finance: 4 }), 5);
      expect(result?.compositeScore).toBe(1);
      expect(result?.delta).toBe(-4);
    });

    it('treats a previous score of 1 as a valid baseline', () => {
      expect(computeComposite(full({}, 50), 1)?.delta).toBe(49);
    });
  });
});

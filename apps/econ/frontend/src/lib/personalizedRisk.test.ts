import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateAgeSensitivity,
  calculateCategoryImpact,
  calculateEquitySensitivity,
  calculateForeignExposure,
  calculatePersonalizedScore,
  clamp,
  getCombinedMultiplier,
  getIndicatorRelevance,
  getPersonalizedThresholds,
  getSensitivityMultiplier,
  personalizeRisk,
} from './personalizedRisk';
import type { AssetAllocation, MonitoringSensitivity, UserProfile } from './types/profile';
import type { CompositeRisk, RiskAssessment } from '../services/api';

const ZERO_ALLOCATION: AssetAllocation = {
  domestic_equity: 0,
  developed_equity: 0,
  emerging_equity: 0,
  domestic_bond: 0,
  developed_bond: 0,
  emerging_bond: 0,
  domestic_reit: 0,
  developed_reit: 0,
  cash: 0,
};

const alloc = (overrides: Partial<AssetAllocation> = {}): AssetAllocation => ({ ...ZERO_ALLOCATION, ...overrides });

const profile = (
  age: number,
  sensitivity: MonitoringSensitivity,
  allocation: Partial<AssetAllocation>,
): UserProfile => ({ age, sensitivity, allocation: alloc(allocation) });

// age 35 / 75% equity / standard: every individual multiplier is 1
const NEUTRAL = profile(35, 'standard', { domestic_equity: 75 });
// 1 + 0.195 + 0 + 0
const MID = profile(48, 'standard', { domestic_equity: 75 });
// additive sum 1.405 is above the cap
const CAPPED = profile(48, 'sensitive', { domestic_equity: 90 });
// additive sum 0.4 is below the floor
const FLOORED = profile(20, 'relaxed', { cash: 100 });

describe('clamp', () => {
  it('returns the bound when the value is outside and the value when inside', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('calculateAgeSensitivity', () => {
  it('is exactly 1 at age 35', () => {
    expect(calculateAgeSensitivity(35)).toBe(1);
  });

  it('adds 0.015 per year above 35 and subtracts it below 35', () => {
    expect(calculateAgeSensitivity(48)).toBeCloseTo(1.195, 10);
    expect(calculateAgeSensitivity(26)).toBeCloseTo(0.865, 10);
  });

  it('is clamped to 0.85 from below', () => {
    expect(calculateAgeSensitivity(25)).toBeCloseTo(0.85, 10);
    expect(calculateAgeSensitivity(24)).toBe(0.85);
    expect(calculateAgeSensitivity(0)).toBe(0.85);
  });

  it('is clamped to 1.35 from above', () => {
    expect(calculateAgeSensitivity(58)).toBeCloseTo(1.345, 10);
    expect(calculateAgeSensitivity(59)).toBe(1.35);
    expect(calculateAgeSensitivity(100)).toBe(1.35);
  });
});

describe('calculateEquitySensitivity', () => {
  it('is 0.7 with no equity and ignores non-equity classes', () => {
    expect(calculateEquitySensitivity(alloc())).toBe(0.7);
    expect(
      calculateEquitySensitivity(alloc({ domestic_bond: 30, developed_bond: 20, emerging_bond: 10, domestic_reit: 10, developed_reit: 10, cash: 20 })),
    ).toBe(0.7);
  });

  it('adds 0.004 per percentage point of total equity across all three equity classes', () => {
    expect(calculateEquitySensitivity(alloc({ domestic_equity: 20, developed_equity: 30, emerging_equity: 10 }))).toBeCloseTo(0.94, 10);
    expect(calculateEquitySensitivity(alloc({ domestic_equity: 90 }))).toBeCloseTo(1.06, 10);
    expect(calculateEquitySensitivity(alloc({ developed_equity: 100 }))).toBeCloseTo(1.1, 10);
  });

  it('is clamped to 1.3 from above', () => {
    expect(calculateEquitySensitivity(alloc({ domestic_equity: 150 }))).toBeCloseTo(1.3, 10);
    expect(calculateEquitySensitivity(alloc({ domestic_equity: 151 }))).toBe(1.3);
    expect(calculateEquitySensitivity(alloc({ domestic_equity: 400 }))).toBe(1.3);
  });

  it('is clamped to 0.7 from below for negative input', () => {
    expect(calculateEquitySensitivity(alloc({ domestic_equity: -50 }))).toBe(0.7);
  });
});

describe('calculateForeignExposure', () => {
  it('sums developed/emerging equity, developed/emerging bonds and developed REIT only', () => {
    const allocation = alloc({
      developed_equity: 1,
      emerging_equity: 2,
      developed_bond: 4,
      emerging_bond: 8,
      developed_reit: 16,
      domestic_equity: 32,
      domestic_bond: 64,
      domestic_reit: 128,
      cash: 256,
    });
    expect(calculateForeignExposure(allocation)).toBe(31);
  });
});

describe('getSensitivityMultiplier', () => {
  it('maps each preference to its multiplier', () => {
    expect(getSensitivityMultiplier('sensitive')).toBe(1.15);
    expect(getSensitivityMultiplier('standard')).toBe(1);
    expect(getSensitivityMultiplier('relaxed')).toBe(0.85);
  });
});

describe('getCombinedMultiplier', () => {
  it('is 1 for the neutral profile', () => {
    expect(getCombinedMultiplier(NEUTRAL)).toBeCloseTo(1, 10);
  });

  it('adds the deviations from 1.0 instead of multiplying the factors', () => {
    const p = profile(48, 'sensitive', { domestic_equity: 75 });
    expect(getCombinedMultiplier(p)).toBeCloseTo(1.345, 10);
    expect(getCombinedMultiplier(p)).not.toBeCloseTo(1.195 * 1.15, 3);
  });

  it('combines a younger, cautious profile below 1', () => {
    const p = profile(26, 'relaxed', { domestic_equity: 75 });
    expect(getCombinedMultiplier(p)).toBeCloseTo(1 - 0.135 - 0.15, 10);
  });

  it('is capped at 1.4', () => {
    expect(getCombinedMultiplier(CAPPED)).toBe(1.4);
    expect(getCombinedMultiplier(profile(70, 'sensitive', { domestic_equity: 100 }))).toBe(1.4);
  });

  it('is floored at 0.7', () => {
    expect(getCombinedMultiplier(FLOORED)).toBe(0.7);
  });

  it('stays unclamped just inside the bounds', () => {
    expect(getCombinedMultiplier(profile(48, 'standard', { domestic_equity: 100 }))).toBeCloseTo(1.295, 10);
    expect(getCombinedMultiplier(profile(35, 'relaxed', { domestic_equity: 75 }))).toBeCloseTo(0.85, 10);
  });
});

describe('calculatePersonalizedScore', () => {
  it('rounds the scaled score to the nearest integer', () => {
    expect(calculatePersonalizedScore(40, MID)).toBe(48);
    expect(calculatePersonalizedScore(41, MID)).toBe(49);
    expect(calculatePersonalizedScore(42, MID)).toBe(50);
    expect(calculatePersonalizedScore(50, MID)).toBe(60);
  });

  it('returns the generic score unchanged for the neutral profile', () => {
    for (const score of [0, 1, 33, 50, 77, 100]) expect(calculatePersonalizedScore(score, NEUTRAL)).toBe(score);
  });

  it('clamps at 100 starting from the first generic score that overflows', () => {
    expect(calculatePersonalizedScore(71, CAPPED)).toBe(99);
    expect(calculatePersonalizedScore(72, CAPPED)).toBe(100);
    expect(calculatePersonalizedScore(100, CAPPED)).toBe(100);
  });

  it('clamps negative generic scores to 0', () => {
    expect(calculatePersonalizedScore(-10, CAPPED)).toBe(0);
    expect(calculatePersonalizedScore(0, CAPPED)).toBe(0);
  });

  it('scales down for the floored profile', () => {
    expect(calculatePersonalizedScore(100, FLOORED)).toBe(70);
    expect(calculatePersonalizedScore(50, FLOORED)).toBe(35);
  });

  it.each([
    ['neutral', NEUTRAL],
    ['mid', MID],
    ['capped', CAPPED],
    ['floored', FLOORED],
  ])('is an integer within 0..100 and non-decreasing in the generic score (%s profile)', (_name, p) => {
    let previous = -1;
    for (let score = 0; score <= 100; score++) {
      const result = calculatePersonalizedScore(score, p);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(result).toBeGreaterThanOrEqual(previous);
      previous = result;
    }
  });

  it('ranks a riskier profile at or above a safer one for the same generic score', () => {
    for (const score of [10, 40, 70, 95]) {
      expect(calculatePersonalizedScore(score, CAPPED)).toBeGreaterThanOrEqual(calculatePersonalizedScore(score, MID));
      expect(calculatePersonalizedScore(score, MID)).toBeGreaterThanOrEqual(calculatePersonalizedScore(score, FLOORED));
    }
  });
});

describe('getPersonalizedThresholds', () => {
  it('is 40 and 60 for the neutral profile', () => {
    expect(getPersonalizedThresholds(NEUTRAL)).toEqual({ warning: 40, alert: 60 });
  });

  it('divides 40 and 60 by the combined multiplier and rounds', () => {
    expect(getPersonalizedThresholds(CAPPED)).toEqual({ warning: 29, alert: 43 });
    expect(getPersonalizedThresholds(FLOORED)).toEqual({ warning: 57, alert: 86 });
    expect(getPersonalizedThresholds(MID)).toEqual({ warning: 33, alert: 50 });
  });

  it.each([
    ['neutral', NEUTRAL],
    ['mid', MID],
    ['capped', CAPPED],
    ['floored', FLOORED],
  ])('maps back to the personalized 40 / 60 scale within rounding error (%s profile)', (_name, p) => {
    const { warning, alert } = getPersonalizedThresholds(p);
    expect(Math.abs(calculatePersonalizedScore(warning, p) - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs(calculatePersonalizedScore(alert, p) - 60)).toBeLessThanOrEqual(1);
  });

  it('keeps the warning below the alert and both inside 10..90', () => {
    for (let age = 18; age <= 80; age += 2) {
      for (const sensitivity of ['sensitive', 'standard', 'relaxed'] as const) {
        for (const equity of [0, 40, 100]) {
          const { warning, alert } = getPersonalizedThresholds(profile(age, sensitivity, { domestic_equity: equity }));
          expect(warning).toBeLessThan(alert);
          expect(warning).toBeGreaterThanOrEqual(10);
          expect(alert).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('lowers both thresholds as the combined multiplier rises', () => {
    const low = getPersonalizedThresholds(FLOORED);
    const mid = getPersonalizedThresholds(MID);
    const high = getPersonalizedThresholds(CAPPED);
    expect(low.warning).toBeGreaterThan(mid.warning);
    expect(mid.warning).toBeGreaterThan(high.warning);
    expect(low.alert).toBeGreaterThan(mid.alert);
    expect(mid.alert).toBeGreaterThan(high.alert);
  });
});

describe('calculateCategoryImpact', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // technology: developed_equity counts 1.0, emerging_equity and domestic_equity count 0.5
  const tech = (allocation: Partial<AssetAllocation>, score = 50) =>
    calculateCategoryImpact('technology', score, alloc(allocation));

  describe('base level from affectedPct', () => {
    it.each([
      [0, 'low'],
      [14, 'low'],
      [15, 'medium'],
      [39, 'medium'],
      [40, 'high'],
      [100, 'high'],
    ])('affectedPct %i gives %s at a neutral score', (pct, level) => {
      const result = tech({ developed_equity: pct });
      expect(result.affectedPct).toBe(pct);
      expect(result.impactLevel).toBe(level);
    });

    it('weights medium-impact classes by 0.5', () => {
      expect(tech({ emerging_equity: 30 }).affectedPct).toBe(15);
      expect(tech({ emerging_equity: 30 }).impactLevel).toBe('medium');
      expect(tech({ domestic_equity: 78 }).affectedPct).toBe(39);
      expect(tech({ domestic_equity: 78 }).impactLevel).toBe('medium');
    });

    it('rounds the blended percentage half up before comparing with the thresholds', () => {
      expect(tech({ emerging_equity: 29 })).toMatchObject({ affectedPct: 15, impactLevel: 'medium' });
      expect(tech({ emerging_equity: 28 })).toMatchObject({ affectedPct: 14, impactLevel: 'low' });
      expect(tech({ domestic_equity: 79 })).toMatchObject({ affectedPct: 40, impactLevel: 'high' });
    });

    it('does not count low-impact classes', () => {
      const result = tech({ domestic_bond: 50, developed_bond: 30, cash: 20 });
      expect(result.affectedPct).toBe(0);
      expect(result.impactLevel).toBe('low');
    });
  });

  describe('score adjustment', () => {
    it('upgrades a medium base to high at score 70 but not at 69', () => {
      expect(tech({ developed_equity: 20 }, 69).impactLevel).toBe('medium');
      expect(tech({ developed_equity: 20 }, 70).impactLevel).toBe('high');
      expect(tech({ developed_equity: 20 }, 100).impactLevel).toBe('high');
    });

    it('upgrades a low base only one level, to medium', () => {
      expect(tech({ developed_equity: 10 }, 69).impactLevel).toBe('low');
      expect(tech({ developed_equity: 10 }, 70).impactLevel).toBe('medium');
      expect(tech({ developed_equity: 10 }, 100).impactLevel).toBe('medium');
    });

    it('keeps a high base at high for any score of 70 or more', () => {
      expect(tech({ developed_equity: 50 }, 70).impactLevel).toBe('high');
      expect(tech({ developed_equity: 50 }, 100).impactLevel).toBe('high');
    });

    it('downgrades a medium base to low at score 29 but not at 30', () => {
      expect(tech({ developed_equity: 20 }, 30).impactLevel).toBe('medium');
      expect(tech({ developed_equity: 20 }, 29).impactLevel).toBe('low');
      expect(tech({ developed_equity: 20 }, 0).impactLevel).toBe('low');
    });

    it('downgrades a high base only one level, to medium', () => {
      expect(tech({ developed_equity: 50 }, 30).impactLevel).toBe('high');
      expect(tech({ developed_equity: 50 }, 29).impactLevel).toBe('medium');
      expect(tech({ developed_equity: 50 }, 0).impactLevel).toBe('medium');
    });

    it('never goes below low', () => {
      expect(tech({ developed_equity: 10 }, 29).impactLevel).toBe('low');
      expect(tech({}, 0).impactLevel).toBe('low');
    });

    it('does not change affectedPct', () => {
      expect(tech({ developed_equity: 20 }, 0).affectedPct).toBe(20);
      expect(tech({ developed_equity: 20 }, 100).affectedPct).toBe(20);
    });
  });

  describe('category to asset class mapping', () => {
    // domestic_equity 2, developed_equity 4, emerging_equity 8, domestic_bond 16, developed_bond 32,
    // emerging_bond 64, domestic_reit 128, developed_reit 256, cash 512
    const distinct = alloc({
      domestic_equity: 2,
      developed_equity: 4,
      emerging_equity: 8,
      domestic_bond: 16,
      developed_bond: 32,
      emerging_bond: 64,
      domestic_reit: 128,
      developed_reit: 256,
      cash: 512,
    });

    it.each([
      ['currency_finance', 364 + 130 / 2],
      ['geopolitics_supply_chain', 72 + 38 / 2],
      ['technology', 4 + 10 / 2],
      ['social_policy', 146 + 32 / 2],
    ])('%s blends its high and medium classes into affectedPct %i', (category, expected) => {
      expect(calculateCategoryImpact(category, 50, distinct).affectedPct).toBe(expected);
    });

    it('echoes the category back', () => {
      expect(calculateCategoryImpact('social_policy', 50, distinct).category).toBe('social_policy');
    });
  });

  describe('description', () => {
    it.each([
      ['currency_finance', '円高進行時に為替差損が生じるリスクがあります'],
      ['geopolitics_supply_chain', '地政学的な緊張により供給網が混乱するリスクがあります'],
      ['technology', '規制強化や半導体関連のリスクがあります'],
      ['social_policy', '政策変更や金利動向の影響を受けるリスクがあります'],
    ])('starts with the %s risk text', (category, text) => {
      expect(calculateCategoryImpact(category, 50, alloc({ developed_equity: 100, domestic_bond: 100 })).description.startsWith(text)).toBe(true);
    });

    it('states the affected percentage and adds the limited-impact note for a low level', () => {
      expect(tech({ developed_equity: 10 }).description).toBe(
        '規制強化や半導体関連のリスクがあります（影響を受ける割合: 約10%）。現在のポートフォリオへの影響は限定的です。',
      );
    });

    it('omits the limited-impact note for medium and high levels', () => {
      expect(tech({ developed_equity: 20 }).description).toBe('規制強化や半導体関連のリスクがあります（影響を受ける割合: 約20%）。');
      expect(tech({ developed_equity: 50 }).description).toBe('規制強化や半導体関連のリスクがあります（影響を受ける割合: 約50%）。');
    });

    it('adds the note when a low score pushes the level to low and omits it when a high score lifts it', () => {
      expect(tech({ developed_equity: 20 }, 0).description).toContain('現在のポートフォリオへの影響は限定的です。');
      expect(tech({ developed_equity: 10 }, 100).description).not.toContain('限定的');
    });
  });

  describe('unknown category', () => {
    it('returns a neutral result regardless of allocation and score', () => {
      const result = calculateCategoryImpact('mystery', 100, alloc({ developed_equity: 100, domestic_equity: 100 }));
      expect(result).toEqual({
        category: 'mystery',
        impactLevel: 'low',
        affectedPct: 0,
        description: '現在のポートフォリオへの影響は限定的です。',
      });
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'])(
      'treats the inherited property name %s as unknown instead of throwing',
      (category) => {
        const result = calculateCategoryImpact(category, 100, alloc({ developed_equity: 100, domestic_equity: 100 }));
        expect(result).toEqual({
          category,
          impactLevel: 'low',
          affectedPct: 0,
          description: '現在のポートフォリオへの影響は限定的です。',
        });
      },
    );
  });
});

describe('getIndicatorRelevance', () => {
  type Row = [Partial<AssetAllocation>, 'high' | 'medium' | 'low'];

  const foreignBoundaries: Row[] = [
    [{ developed_equity: 51 }, 'high'],
    [{ developed_equity: 50 }, 'medium'],
    [{ developed_equity: 21 }, 'medium'],
    [{ developed_equity: 20 }, 'low'],
    [{}, 'low'],
  ];

  const cases: Array<[string, Row[]]> = [
    ['USDJPY', foreignBoundaries],
    [
      'VIX',
      [
        [{ domestic_equity: 61 }, 'high'],
        [{ domestic_equity: 60 }, 'medium'],
        [{ domestic_equity: 31 }, 'medium'],
        [{ domestic_equity: 30 }, 'low'],
        [{ domestic_equity: 20, developed_equity: 20, emerging_equity: 21 }, 'high'],
        [{ domestic_equity: 20, developed_equity: 20, emerging_equity: 20 }, 'medium'],
        [{ domestic_bond: 100 }, 'low'],
      ],
    ],
    [
      'UST3M',
      [
        [{ cash: 21 }, 'high'],
        [{ cash: 20 }, 'low'],
        [{ domestic_bond: 21 }, 'high'],
        [{ domestic_bond: 20 }, 'low'],
        [{ developed_bond: 11 }, 'medium'],
        [{ developed_bond: 10 }, 'low'],
        [{ cash: 20, developed_bond: 11 }, 'medium'],
        [{ cash: 21, developed_bond: 11 }, 'high'],
      ],
    ],
    [
      'DJIA',
      [
        [{ developed_equity: 31 }, 'high'],
        [{ developed_equity: 30 }, 'low'],
        [{ domestic_equity: 61 }, 'high'],
        [{ emerging_equity: 61 }, 'high'],
        [{ domestic_equity: 60 }, 'medium'],
        [{ domestic_equity: 31 }, 'medium'],
        [{ domestic_equity: 30 }, 'low'],
      ],
    ],
    [
      'SPX',
      [
        [{ developed_equity: 31 }, 'high'],
        [{ domestic_equity: 60 }, 'medium'],
        [{ domestic_equity: 30 }, 'low'],
      ],
    ],
    [
      'TOPIX',
      [
        [{ domestic_equity: 31 }, 'high'],
        [{ domestic_equity: 30 }, 'medium'],
        [{ domestic_equity: 11 }, 'medium'],
        [{ domestic_equity: 10 }, 'low'],
        [{ developed_equity: 100 }, 'low'],
      ],
    ],
    [
      'UST10Y',
      [
        [{ developed_bond: 21 }, 'high'],
        [{ developed_bond: 20 }, 'low'],
        [{ domestic_equity: 51 }, 'medium'],
        [{ domestic_equity: 50 }, 'low'],
        [{ developed_bond: 21, domestic_equity: 51 }, 'high'],
      ],
    ],
    [
      'WTI',
      [
        [{ emerging_equity: 16 }, 'high'],
        [{ emerging_equity: 15 }, 'low'],
        [{ emerging_bond: 11 }, 'high'],
        [{ emerging_bond: 10 }, 'low'],
        [{ developed_equity: 41 }, 'medium'],
        [{ developed_equity: 40 }, 'low'],
      ],
    ],
    [
      'GOLD',
      [
        [{ domestic_equity: 71 }, 'high'],
        [{ domestic_equity: 70 }, 'medium'],
        [{ domestic_equity: 41 }, 'medium'],
        [{ domestic_equity: 40 }, 'low'],
      ],
    ],
    [
      'HYG',
      [
        [{ developed_equity: 31 }, 'high'],
        [{ developed_equity: 30 }, 'low'],
        [{ emerging_equity: 11 }, 'high'],
        [{ emerging_equity: 10 }, 'low'],
        [{ domestic_equity: 31 }, 'medium'],
        [{ domestic_equity: 30 }, 'low'],
      ],
    ],
  ];

  describe.each(cases)('%s', (code, rows) => {
    it.each(rows)('allocation %j is %s', (allocation, expected) => {
      expect(getIndicatorRelevance(code, alloc(allocation))).toBe(expected);
    });
  });

  it('counts every foreign asset class toward USDJPY relevance and no domestic one', () => {
    for (const key of ['developed_equity', 'emerging_equity', 'developed_bond', 'emerging_bond', 'developed_reit'] as const) {
      expect(getIndicatorRelevance('USDJPY', alloc({ [key]: 51 })), key).toBe('high');
    }
    for (const key of ['domestic_equity', 'domestic_bond', 'domestic_reit', 'cash'] as const) {
      expect(getIndicatorRelevance('USDJPY', alloc({ [key]: 100 })), key).toBe('low');
    }
  });

  it('returns low for unknown indicator codes', () => {
    expect(getIndicatorRelevance('NOPE', alloc({ developed_equity: 100 }))).toBe('low');
    expect(getIndicatorRelevance('', alloc({ developed_equity: 100 }))).toBe('low');
  });
});

describe('personalizeRisk', () => {
  const composite = (score: number): CompositeRisk => ({ compositeScore: score, level: 'elevated', breakdown: [] });
  const risk = (category: string, score: number): RiskAssessment => ({
    category,
    score,
    level: 'elevated',
    summaryJa: '',
    factorsJa: [],
    assessedAt: '2026-10-24T00:00:00.000Z',
  });

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives score, signal and interpretation from the composite and the profile', () => {
    const result = personalizeRisk(composite(50), [], MID)!;
    expect(result.personalizedScore).toBe(60);
    expect(result.signal).toBe('prepare');
    expect(result.interpretation).toBe('48歳・株式75%のポートフォリオでは、リバランスの準備を検討すべき水準です');
  });

  it('switches signal exactly at the personalized score boundaries 60/61 and 80/81', () => {
    const signalFor = (score: number) => personalizeRisk(composite(score), [], CAPPED)?.signal;
    expect(signalFor(43)).toBe('prepare');
    expect(signalFor(44)).toBe('hedge');
    expect(signalFor(57)).toBe('hedge');
    expect(signalFor(58)).toBe('act');
  });

  it.each([NaN, Infinity])('returns null when the composite score is %s', (score) => {
    expect(personalizeRisk(composite(score), [], NEUTRAL)).toBeNull();
  });

  it('rounds the equity percentage shown in the interpretation', () => {
    const p = profile(35, 'standard', { domestic_equity: 33.5 });
    expect(personalizeRisk(composite(10), [], p)?.interpretation).toContain('株式34%');
  });

  it('maps each risk to a category impact in order, using the risk score', () => {
    const p = profile(35, 'standard', { developed_equity: 20 });
    const result = personalizeRisk(composite(40), [risk('technology', 70), risk('technology', 20), risk('mystery', 50)], p)!;
    expect(result.categoryImpacts.map(i => [i.category, i.impactLevel])).toEqual([
      ['technology', 'high'],
      ['technology', 'low'],
      ['mystery', 'low'],
    ]);
  });

  it('returns no category impacts for no risks', () => {
    expect(personalizeRisk(composite(40), [], NEUTRAL)?.categoryImpacts).toEqual([]);
  });
});

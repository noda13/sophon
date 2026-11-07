import { describe, expect, it } from 'vitest';
import { RISK_CATEGORIES, RISK_WEIGHTS, scoreToLevel } from './riskConstants';

describe('scoreToLevel', () => {
  it.each([
    [0, 'low'],
    [20, 'low'],
    [21, 'moderate'],
    [40, 'moderate'],
    [41, 'elevated'],
    [60, 'elevated'],
    [61, 'high'],
    [80, 'high'],
    [81, 'critical'],
    [100, 'critical'],
  ])('maps score %i to %s', (score, level) => {
    expect(scoreToLevel(score)).toBe(level);
  });

  it('puts fractional scores on the lower level up to the inclusive upper bound', () => {
    expect(scoreToLevel(20.5)).toBe('moderate');
    expect(scoreToLevel(80.5)).toBe('critical');
  });

  it('treats out-of-range scores as the nearest extreme', () => {
    expect(scoreToLevel(-5)).toBe('low');
    expect(scoreToLevel(150)).toBe('critical');
  });
});

describe('RISK_WEIGHTS', () => {
  it('sums to 1', () => {
    const total = Object.values(RISK_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('has exactly the keys of RISK_CATEGORIES', () => {
    expect(Object.keys(RISK_WEIGHTS).sort()).toEqual([...RISK_CATEGORIES].sort());
  });

  it('gives every category a positive weight', () => {
    for (const category of RISK_CATEGORIES) expect(RISK_WEIGHTS[category], category).toBeGreaterThan(0);
  });
});

describe('RISK_CATEGORIES', () => {
  it('contains the four categories without duplicates', () => {
    expect(new Set(RISK_CATEGORIES).size).toBe(RISK_CATEGORIES.length);
  });
});

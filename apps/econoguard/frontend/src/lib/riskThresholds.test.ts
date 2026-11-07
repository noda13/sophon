import { describe, expect, it } from 'vitest';
import { scoreToLevel } from '../../../backend/src/schemas/riskConstants';
import {
  CHART_ALERT_SCORE,
  CHART_WARNING_SCORE,
  RISK_LEVEL_BOUNDS,
  SIGNAL_BOUNDS,
} from './riskThresholds';

describe('riskThresholds', () => {
  it('has strictly increasing level bounds inside the 0-100 score range', () => {
    const bounds = [...RISK_LEVEL_BOUNDS];
    expect(bounds).toHaveLength(4);
    bounds.forEach((bound, i) => {
      expect(bound).toBeGreaterThan(0);
      expect(bound).toBeLessThan(100);
      if (i > 0) expect(bound).toBeGreaterThan(bounds[i - 1]);
    });
  });

  it('puts each level boundary on the same score as the backend scoreToLevel', () => {
    const levels = ['low', 'moderate', 'elevated', 'high'] as const;
    RISK_LEVEL_BOUNDS.forEach((bound, i) => {
      expect(scoreToLevel(bound), `score ${bound}`).toBe(levels[i]);
      expect(scoreToLevel(bound + 1), `score ${bound + 1}`).toBe(i === 3 ? 'critical' : levels[i + 1]);
    });
  });

  it('derives signal bounds from the level bounds', () => {
    expect([SIGNAL_BOUNDS.hold, SIGNAL_BOUNDS.watch, SIGNAL_BOUNDS.prepare, SIGNAL_BOUNDS.hedge]).toEqual([
      ...RISK_LEVEL_BOUNDS,
    ]);
  });

  it('marks the start of "prepare" and "hedge" with the chart reference lines', () => {
    expect(CHART_WARNING_SCORE).toBe(SIGNAL_BOUNDS.watch);
    expect(CHART_ALERT_SCORE).toBe(SIGNAL_BOUNDS.prepare);
    expect(CHART_WARNING_SCORE).toBeLessThan(CHART_ALERT_SCORE);
  });
});

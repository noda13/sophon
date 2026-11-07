import { describe, expect, it } from 'vitest';
import { scoreToLevel } from '../../../backend/src/schemas/riskConstants';
import { ACTION_SIGNAL_CONFIG, getSignalFromScore } from './actionSignals';

describe('getSignalFromScore', () => {
  it.each([
    [0, 'hold'],
    [20, 'hold'],
    [21, 'watch'],
    [40, 'watch'],
    [41, 'prepare'],
    [60, 'prepare'],
    [61, 'hedge'],
    [80, 'hedge'],
    [81, 'act'],
    [100, 'act'],
  ])('maps score %i to %s', (score, signal) => {
    expect(getSignalFromScore(score)).toBe(signal);
  });

  it('returns a signal that has a display configuration for every score', () => {
    for (let score = 0; score <= 100; score++) {
      const signal = getSignalFromScore(score);
      expect(signal).not.toBeNull();
      expect(ACTION_SIGNAL_CONFIG[signal!]).toBeDefined();
    }
  });

  it.each([NaN, Infinity, -Infinity])('returns null instead of a signal for %s', (score) => {
    expect(getSignalFromScore(score)).toBeNull();
  });

  it('switches signal at the same scores as the backend risk levels', () => {
    const levelToSignal = { low: 'hold', moderate: 'watch', elevated: 'prepare', high: 'hedge', critical: 'act' } as const;
    for (let score = 0; score <= 100; score++) {
      expect(getSignalFromScore(score), String(score)).toBe(levelToSignal[scoreToLevel(score)]);
    }
  });
});

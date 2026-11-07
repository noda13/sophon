import { describe, expect, it } from 'vitest';
import { RISK_CATEGORIES as BACKEND_RISK_CATEGORIES } from '../../../backend/src/schemas/riskConstants';
import { RISK_CATEGORIES, categoryLabels, riskLevelConfig } from './riskColors';

describe('riskColors', () => {
  it('lists the same risk categories, in the same order, as the backend', () => {
    expect([...RISK_CATEGORIES]).toEqual([...BACKEND_RISK_CATEGORIES]);
  });

  it('has a label for every category', () => {
    for (const category of RISK_CATEGORIES) {
      expect(categoryLabels[category], category).toBeTruthy();
    }
  });

  it('has a display configuration for every risk level the backend can return', () => {
    expect(Object.keys(riskLevelConfig).sort()).toEqual(['critical', 'elevated', 'high', 'low', 'moderate']);
  });
});

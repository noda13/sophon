import { describe, expect, it } from 'vitest';
import { RiskCategorySchema } from '../../../../shared/schema/econ';
import { RISK_CATEGORIES, categoryLabels, riskLevelConfig } from './riskColors';

describe('riskColors', () => {
  it('lists the same risk categories, in the same order, as the schema', () => {
    expect([...RISK_CATEGORIES]).toEqual([...RiskCategorySchema.options]);
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

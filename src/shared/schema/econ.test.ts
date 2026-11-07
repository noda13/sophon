import { describe, expect, it } from 'vitest';
import { readLegacyJson } from './legacy-data.testutil';
import {
  CompositeRiskSchema,
  EventsFileSchema,
  IndicatorsFileSchema,
  NewsFileSchema,
  RiskHistoryFileSchema,
  RisksFileSchema,
} from './econ';

describe('econ schema against legacy data', () => {
  it.each([
    ['news.json', NewsFileSchema],
    ['indicators.json', IndicatorsFileSchema],
    ['risks.json', RisksFileSchema],
    ['risk-history.json', RiskHistoryFileSchema],
    ['events.json', EventsFileSchema],
    ['composite-risk.json', CompositeRiskSchema],
  ] as const)('parses %s', (file, schema) => {
    const r = schema.safeParse(readLegacyJson('econ', file));
    expect(r.success).toBe(true);
  });
});

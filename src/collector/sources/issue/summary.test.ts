import { describe, expect, it } from 'vitest';
import { newIssue } from './feeds';
import { buildCategorySummary } from './summary';
import { CategorySummaryFileSchema, type Issue } from '../../../shared/schema/issue';

const now = new Date('2026-11-07T00:00:00.000Z');
const make = (over: Partial<Issue>): Issue => ({
  ...newIssue(
    { id: 'x', title: 't', url: 'https://example.com/a', publishedAt: '2026-11-06T00:00:00.000Z', summary: '' },
    { url: 'https://example.com/feed', source: 'nhk', sourceType: 'news_jp' },
    now,
  ),
  ...over,
});

describe('buildCategorySummary', () => {
  it('averages scores per category and sorts by count', () => {
    const summary = buildCategorySummary([
      make({ category: 'education', severityScore: 40, appifiabilityScore: 70 }),
      make({ category: 'aging_care', severityScore: 80, appifiabilityScore: 61 }),
      make({ category: 'aging_care', severityScore: 71, appifiabilityScore: 60 }),
    ]);
    expect(summary).toEqual([
      { category: 'aging_care', count: 2, avgSeverity: 76, avgAppifiability: 61 },
      { category: 'education', count: 1, avgSeverity: 40, avgAppifiability: 70 },
    ]);
    expect(CategorySummaryFileSchema.safeParse(summary).success).toBe(true);
  });

  it('ignores unclassified issues', () => {
    expect(buildCategorySummary([make({ category: '' })])).toEqual([]);
  });
});

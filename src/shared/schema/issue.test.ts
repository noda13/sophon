import { describe, expect, it } from 'vitest';
import { readLegacyJson } from './legacy-data.testutil';
import { CategorySummaryFileSchema, IdeaSchema, IdeasFileSchema, IssuesFileSchema } from './issue';

describe('issue schema against legacy data', () => {
  it('parses issues.json', () => {
    expect(IssuesFileSchema.safeParse(readLegacyJson('issue', 'issues.json')).success).toBe(true);
  });

  it('parses ideas.json', () => {
    expect(IdeasFileSchema.safeParse(readLegacyJson('issue', 'ideas.json')).success).toBe(true);
  });

  it('parses category-summary.json', () => {
    expect(CategorySummaryFileSchema.safeParse(readLegacyJson('issue', 'category-summary.json')).success).toBe(true);
  });

  it('requires ideas to clear the appifiability threshold and have ideaGeneratedAt', () => {
    const [issue] = IssuesFileSchema.parse(readLegacyJson('issue', 'issues.json'));
    expect(issue).toBeDefined();
    expect(IdeaSchema.safeParse(issue).success).toBe(false);
    expect(IdeaSchema.safeParse({ ...issue, appifiabilityScore: 70, ideaGeneratedAt: '2026-01-01T00:00:00.000Z' }).success).toBe(true);
  });
});

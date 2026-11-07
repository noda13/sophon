import { describe, expect, it } from 'vitest';
import { newIssue } from './feeds';
import { applyIdea, isIdeaTarget, normalizeDifficulty, toIdeas } from './ideas';
import { IdeasFileSchema, type Issue } from '../../../shared/schema/issue';

const now = new Date('2026-11-07T00:00:00.000Z');
const make = (over: Partial<Issue> = {}): Issue => ({
  ...newIssue(
    { id: 'x', title: 't', url: 'https://example.com/a', publishedAt: '2026-11-06T00:00:00.000Z', summary: '' },
    { url: 'https://example.com/feed', source: 'nhk', sourceType: 'news_jp' },
    now,
  ),
  ...over,
});

describe('isIdeaTarget', () => {
  it('requires appifiability of 60 or more', () => {
    expect(isIdeaTarget(make({ appifiabilityScore: 59 }))).toBe(false);
    expect(isIdeaTarget(make({ appifiabilityScore: 60 }))).toBe(true);
  });

  it('skips issues that already have an idea', () => {
    expect(isIdeaTarget(make({ appifiabilityScore: 90, ideaGeneratedAt: now.toISOString() }))).toBe(false);
  });
});

describe('normalizeDifficulty', () => {
  it('keeps valid values and defaults to medium', () => {
    expect(normalizeDifficulty('high')).toBe('high');
    expect(normalizeDifficulty(' LOW ')).toBe('low');
    expect(normalizeDifficulty('hard')).toBe('medium');
  });
});

describe('applyIdea', () => {
  it('fills the idea fields', () => {
    const issue = make({ appifiabilityScore: 80 });
    applyIdea(issue, { proposedAppIdea: '案', mvpFeatures: ['a', 'b'], targetUsers: '高齢者', difficulty: 'x' }, now);
    expect(issue).toMatchObject({
      proposedAppIdea: '案',
      mvpFeatures: ['a', 'b'],
      targetUsers: '高齢者',
      difficulty: 'medium',
      ideaGeneratedAt: now.toISOString(),
    });
  });
});

describe('toIdeas', () => {
  const withIdea = (id: string, score: number) =>
    make({ id, appifiabilityScore: score, proposedAppIdea: '案', ideaGeneratedAt: now.toISOString() });

  it('keeps issues with score >= 60 and a generated idea', () => {
    const ideas = toIdeas([withIdea('a', 60), withIdea('b', 59), make({ id: 'c', appifiabilityScore: 90 })]);
    expect(ideas.map((i) => i.id)).toEqual(['a']);
    expect(IdeasFileSchema.safeParse(ideas).success).toBe(true);
  });
});

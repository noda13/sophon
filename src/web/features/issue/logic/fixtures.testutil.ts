import type { Idea, Issue } from '../../../../shared/schema/issue';

export function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'i1',
    source: 'nhk',
    sourceType: 'news_jp',
    originalTitle: '題名',
    originalUrl: 'https://example.com/a',
    publishedAt: '2026-11-01T00:00:00.000Z',
    rawContent: '',
    summaryJa: '要約',
    category: 'education',
    severityScore: 50,
    urgencyScore: 50,
    appifiabilityScore: 50,
    affectedDomain: [],
    classifiedAt: '2026-11-01T01:00:00.000Z',
    proposedAppIdea: '',
    mvpFeatures: [],
    targetUsers: '',
    difficulty: '',
    ideaGeneratedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    ...makeIssue({
      proposedAppIdea: 'アプリ案',
      mvpFeatures: ['機能A'],
      targetUsers: '住民',
      difficulty: 'medium',
    }),
    appifiabilityScore: 70,
    ideaGeneratedAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

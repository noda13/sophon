import { describe, expect, it } from 'vitest';
import { articleId } from '../../core/rss';
import { buildFeeds, issueId, newIssue, seenIdsOf } from './feeds';
import { IssueSchema } from '../../../shared/schema/issue';

describe('buildFeeds', () => {
  it('skips the RSSHub feeds when RSSHUB_URL is unset or empty', () => {
    for (const env of [{}, { RSSHUB_URL: '' }, { RSSHUB_URL: '  ' }]) {
      expect(buildFeeds(env).filter((f) => f.sourceType === 'twitter')).toEqual([]);
    }
  });

  it('honours RSSHUB_URL and rejects unsafe values', () => {
    expect(buildFeeds({ RSSHUB_URL: 'https://hub.example.com/' }).map((f) => f.url)).toContain(
      'https://hub.example.com/twitter/user/jijicom',
    );
    expect(() => buildFeeds({ RSSHUB_URL: 'http://example.com' })).toThrow(/https/);
    expect(() => buildFeeds({ RSSHUB_URL: 'https://192.168.0.1' })).toThrow(/private/);
  });

  it('has unique source names and omits feeds that cannot be fetched', () => {
    const names = buildFeeds({}).map((f) => f.source);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('cao');
    expect(names).not.toContain('reuters');
  });
});

describe('issue ids', () => {
  it('extends the core article id so legacy 32-char ids can be matched by prefix', () => {
    const id = issueId('https://example.com/a', 'title');
    expect(id).toHaveLength(32);
    expect(id.startsWith(articleId('https://example.com/a', 'title'))).toBe(true);
    expect(seenIdsOf([{ id }])).toEqual([articleId('https://example.com/a', 'title')]);
  });
});

describe('newIssue', () => {
  it('produces an unclassified issue that satisfies the schema', () => {
    const issue = newIssue(
      { id: 'x', title: 't', url: 'https://example.com/a', publishedAt: '2026-11-06T00:00:00.000Z', summary: '' },
      { url: 'https://example.com/feed', source: 'nhk', sourceType: 'news_jp' },
      new Date('2026-11-07T00:00:00.000Z'),
    );
    expect(IssueSchema.safeParse(issue).success).toBe(true);
    expect(issue).toMatchObject({ category: '', classifiedAt: null, ideaGeneratedAt: null, createdAt: '2026-11-07T00:00:00.000Z' });
  });
});

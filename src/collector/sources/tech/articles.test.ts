import { describe, expect, it } from 'vitest';
import type { Article } from '../../../shared/schema/tech';
import { articleId } from '../../core/rss';
import { applySummaries, capFreshPerFeed, retainArticles, toArticle } from './articles';

const article = (id: string, over: Partial<Article> = {}): Article => ({
  id,
  source: 's',
  category: 'trend',
  importance: '中',
  originalTitle: `t-${id}`,
  originalUrl: `https://e.com/${id}`,
  publishedAt: '2026-11-01T00:00:00.000Z',
  summaryJa: '',
  ...over,
});

describe('toArticle', () => {
  it('starts unsummarized with the feed hint as category and 中 importance', () => {
    const id = articleId('https://e.com/a', 'A');
    const a = toArticle(
      { id, title: 'A', url: 'https://e.com/a', publishedAt: '2026-11-01T00:00:00.000Z', summary: '' },
      { url: 'https://e.com/feed', source: 'zenn', hint: 'ai' },
    );
    expect(a).toEqual({
      id,
      source: 'zenn',
      category: 'ai',
      importance: '中',
      originalTitle: 'A',
      originalUrl: 'https://e.com/a',
      publishedAt: '2026-11-01T00:00:00.000Z',
      summaryJa: '',
    });
  });
});

describe('capFreshPerFeed', () => {
  it('keeps the newest items of each feed independently', () => {
    const fresh = [
      article('a1', { source: 'a', publishedAt: '2026-11-01T00:00:00.000Z' }),
      article('a2', { source: 'a', publishedAt: '2026-11-03T00:00:00.000Z' }),
      article('a3', { source: 'a', publishedAt: '2026-11-02T00:00:00.000Z' }),
      article('b1', { source: 'b', publishedAt: '2026-10-01T00:00:00.000Z' }),
    ];
    expect(capFreshPerFeed(fresh, 2).map((a) => a.id)).toEqual(['a2', 'a3', 'b1']);
  });
});

describe('retainArticles', () => {
  const opts = { unsummarizedSlots: 2, maxAttempts: 3 };

  it('only sorts newest first when under the limit', () => {
    const all = [article('old', { publishedAt: '2026-10-01T00:00:00.000Z' }), article('new')];
    expect(retainArticles(all, new Set(), { ...opts, max: 5 }).map((a) => a.id)).toEqual(['new', 'old']);
  });

  it('reserves slots for unsummarized articles, fresh first, give-ups last', () => {
    const day = (n: number) => `2026-11-0${n}T00:00:00.000Z`;
    const all = [
      article('s1', { summaryJa: 'x', publishedAt: day(5) }),
      article('s2', { summaryJa: 'x', publishedAt: day(4) }),
      article('s3', { summaryJa: 'x', publishedAt: day(3) }),
      article('gaveUp', { summaryAttempts: 3, publishedAt: day(6) }),
      article('oldPending', { publishedAt: day(2) }),
      article('fresh', { publishedAt: day(1) }),
    ];
    const kept = retainArticles(all, new Set(['fresh']), { ...opts, max: 4 }).map((a) => a.id);
    expect(kept).toEqual(['s1', 's2', 'oldPending', 'fresh']);
  });
});

describe('applySummaries', () => {
  it('fills category, importance and summary, and clears the attempt counter', () => {
    const batch = [article('a', { summaryAttempts: 2 }), article('b')];
    const n = applySummaries(batch, {
      results: [{ index: 1, summaryJa: '要約B', category: 'security', importance: '高' }],
    });
    expect(n).toBe(1);
    expect(batch[1]).toMatchObject({ summaryJa: '要約B', category: 'security', importance: '高' });
    expect(batch[0]!.summaryJa).toBe('');
    expect(batch[0]!.summaryAttempts).toBe(2);
  });

  it('ignores out-of-range, duplicate and blank entries', () => {
    const batch = [article('a')];
    const n = applySummaries(batch, {
      results: [
        { index: 5, summaryJa: 'x', category: 'ai', importance: '低' },
        { index: 0, summaryJa: '  ', category: 'ai', importance: '低' },
        { index: 0, summaryJa: '最初', category: 'ai', importance: '高' },
        { index: 0, summaryJa: '二つ目', category: 'release', importance: '低' },
      ],
    });
    expect(n).toBe(1);
    expect(batch[0]).toMatchObject({ summaryJa: '最初', category: 'ai', importance: '高' });
  });
});

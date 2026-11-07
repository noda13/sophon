import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectNews, nextSeenIds, selectPublishedNews, RSS_SOURCES } from './news.js';
import { MAX_SUMMARY_ATTEMPTS, type NewsArticle } from './types.js';

const parseURL = vi.fn();

vi.mock('rss-parser', () => ({
  default: class {
    parseURL = parseURL;
  },
}));

function article(id: string, over: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id, source: 'test', originalTitle: `t-${id}`, originalUrl: `https://e.com/${id}`,
    publishedAt: '2026-10-01T00:00:00.000Z', summaryJa: '', relevanceScore: 0, riskCategories: [], ...over,
  };
}

describe('collectNews', () => {
  beforeEach(() => {
    parseURL.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  function feedFor(first: unknown[]) {
    let call = 0;
    parseURL.mockImplementation(async () => ({ items: call++ === 0 ? first : [] }));
  }

  it('skips items without title or link', async () => {
    feedFor([{ title: 'a' }, { link: 'https://e.com/b' }, { title: 'c', link: 'https://e.com/c', pubDate: '2026-10-02T00:00:00Z' }]);
    const result = await collectNews([]);
    expect(result.map(a => a.originalTitle)).toEqual(['c']);
  });

  it('keeps the feed when a pubDate is invalid and falls back to the current time', async () => {
    feedFor([
      { title: 'bad', link: 'https://e.com/bad', pubDate: 'not a date' },
      { title: 'good', link: 'https://e.com/good', pubDate: '2026-10-02T00:00:00Z' },
    ]);
    const result = await collectNews([]);
    expect(result).toHaveLength(2);
    const bad = result.find(a => a.originalTitle === 'bad')!;
    expect(Number.isNaN(new Date(bad.publishedAt).getTime())).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('does not add the same article twice within one run', async () => {
    const dup = { title: 'dup', link: 'https://e.com/dup', pubDate: '2026-10-02T00:00:00Z' };
    parseURL.mockResolvedValue({ items: [dup, dup] });
    const result = await collectNews([]);
    expect(result).toHaveLength(1);
  });

  it('skips articles already in the existing list or the seen-id set', async () => {
    const dummy = { title: 'x', link: 'https://e.com/x', pubDate: '2026-10-02T00:00:00Z' };
    parseURL.mockResolvedValue({ items: [dummy] });
    const [first] = await collectNews([]);

    expect(await collectNews([first])).toHaveLength(1);
    expect(await collectNews([], [first.id])).toHaveLength(0);
  });

  it('survives a failing source and sorts newest first, capped at 200', async () => {
    let call = 0;
    parseURL.mockImplementation(async () => {
      if (call++ === 0) throw new Error('boom');
      return { items: [] };
    });
    const existing = Array.from({ length: 250 }, (_, i) => article(`e${i}`, { publishedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }));
    const result = await collectNews(existing);
    expect(result).toHaveLength(200);
    expect(result[0].id).toBe('e249');
    expect(parseURL).toHaveBeenCalledTimes(RSS_SOURCES.length);
  });
});

describe('selectPublishedNews', () => {
  it('keeps unsummarized and relevant articles and drops summarized low-relevance ones', () => {
    const news = [
      article('pending'),
      article('relevant', { summaryJa: 's', relevanceScore: 30 }),
      article('noise', { summaryJa: 's', relevanceScore: 29 }),
    ];
    expect(selectPublishedNews(news).map(a => a.id)).toEqual(['pending', 'relevant']);
  });

  it('keeps unsummarized articles below the attempt limit and drops those that reached it', () => {
    const news = [
      article('retrying', { summaryAttempts: MAX_SUMMARY_ATTEMPTS - 1 }),
      article('exhausted', { summaryAttempts: MAX_SUMMARY_ATTEMPTS }),
    ];
    expect(selectPublishedNews(news).map(a => a.id)).toEqual(['retrying']);
  });

  it('caps the list at 200', () => {
    expect(selectPublishedNews(Array.from({ length: 300 }, (_, i) => article(`a${i}`)))).toHaveLength(200);
  });
});

describe('nextSeenIds', () => {
  it('adds ids of dropped low-relevance articles without duplicating', () => {
    const news = [article('noise', { summaryJa: 's', relevanceScore: 5 }), article('pending'), article('good', { summaryJa: 's', relevanceScore: 80 })];
    expect(nextSeenIds(['old', 'noise'], news)).toEqual(['old', 'noise']);
    expect(nextSeenIds(['old'], news)).toEqual(['old', 'noise']);
  });

  it('adds ids of unsummarized articles that reached the attempt limit', () => {
    const news = [article('exhausted', { summaryAttempts: MAX_SUMMARY_ATTEMPTS }), article('retrying', { summaryAttempts: 1 })];
    expect(nextSeenIds(['old'], news)).toEqual(['old', 'exhausted']);
  });

  it('keeps only the most recent 2000 ids', () => {
    const prev = Array.from({ length: 2000 }, (_, i) => `id${i}`);
    const next = nextSeenIds(prev, [article('new', { summaryJa: 's', relevanceScore: 0 })]);
    expect(next).toHaveLength(2000);
    expect(next[0]).toBe('id1');
    expect(next.at(-1)).toBe('new');
  });
});

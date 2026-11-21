import { describe, expect, it } from 'vitest';
import type { Article } from '../../../shared/schema/tech';
import { articleId } from '../../core/rss';
import { applySummaries, capFreshPerFeed, prioritizeSecurity, retainArticles, toArticle } from './articles';

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
  const opts = { unsummarizedSlots: 2, maxAttempts: 3, perSourceFloor: 0 };

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

describe('retainArticles per-source floor', () => {
  const opts = { unsummarizedSlots: 2, maxAttempts: 3 };
  const at = (minutes: number) => new Date(Date.UTC(2026, 10, 10) + minutes * 60_000).toISOString();

  const busyAndQuiet = () => [
    ...Array.from({ length: 60 }, (_, i) =>
      article(`busy${i}`, { source: 'busy', summaryJa: 'x', publishedAt: at(1000 + i) }),
    ),
    ...['jvn', 'ipa', 'cisa'].flatMap((source) =>
      [0, 1, 2].map((i) => article(`${source}${i}`, { source, summaryJa: 'x', publishedAt: at(i) })),
    ),
  ];

  it('keeps older low-frequency sources up to the floor when over the limit', () => {
    const kept = retainArticles(busyAndQuiet(), new Set(), { ...opts, max: 20, perSourceFloor: 5 });
    expect(kept).toHaveLength(20);
    for (const source of ['jvn', 'ipa', 'cisa']) {
      expect(kept.filter((a) => a.source === source)).toHaveLength(3);
    }
    expect(kept.filter((a) => a.source === 'busy')).toHaveLength(11);
  });

  it('cuts purely by recency when the floor is 0', () => {
    const kept = retainArticles(busyAndQuiet(), new Set(), { ...opts, max: 20, perSourceFloor: 0 });
    expect(kept.every((a) => a.source === 'busy')).toBe(true);
  });

  it('uses MIN_PER_SOURCE by default', () => {
    const kept = retainArticles(busyAndQuiet(), new Set(), { ...opts, max: 20 });
    expect(kept.filter((a) => a.source === 'jvn')).toHaveLength(3);
  });

  it('does not count reserved unsummarized articles against the unsummarized slots', () => {
    const all = [
      article('q1', { source: 'quiet', publishedAt: at(1) }),
      article('q2', { source: 'quiet', publishedAt: at(2) }),
      ...Array.from({ length: 6 }, (_, i) =>
        article(`b${i}`, { source: 'busy', summaryJa: 'x', publishedAt: at(100 + i) }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        article(`p${i}`, { source: 'busy', publishedAt: at(50 + i) }),
      ),
    ];
    const kept = retainArticles(all, new Set(), { max: 6, perSourceFloor: 2, unsummarizedSlots: 0, maxAttempts: 3 });
    // reserved: b5, b4 (busy), q2, q1 (quiet); pool slots 2 go to summarized b3, b2, not to pending p*.
    expect(kept.map((a) => a.id).sort()).toEqual(['b2', 'b3', 'b4', 'b5', 'q1', 'q2']);
  });

  it('truncates the reserved set to max, newest first, when sources exceed it', () => {
    const all = Array.from({ length: 10 }, (_, i) => article(`a${i}`, { source: `s${i}`, publishedAt: at(i) }));
    const kept = retainArticles(all, new Set(), { ...opts, max: 4, perSourceFloor: 5 });
    expect(kept.map((a) => a.id)).toEqual(['a9', 'a8', 'a7', 'a6']);
  });

  it('returns at most max articles sorted newest first', () => {
    const kept = retainArticles(busyAndQuiet(), new Set(), { ...opts, max: 20, perSourceFloor: 5 });
    expect(kept.length).toBeLessThanOrEqual(20);
    const times = kept.map((a) => new Date(a.publishedAt).getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
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

describe('prioritizeSecurity', () => {
  it('puts security articles first and keeps the relative order within each group', () => {
    const list = [
      article('t1'),
      article('s1', { category: 'security' }),
      article('a1', { category: 'ai' }),
      article('s2', { category: 'security' }),
      article('t2'),
    ];
    expect(prioritizeSecurity(list).map((a) => a.id)).toEqual(['s1', 's2', 't1', 'a1', 't2']);
  });

  it('returns the same Article objects without mutating the input', () => {
    const list = [article('t1'), article('s1', { category: 'security' })];
    const result = prioritizeSecurity(list);
    expect(result[0]).toBe(list[1]);
    expect(result[1]).toBe(list[0]);
    expect(list.map((a) => a.id)).toEqual(['t1', 's1']);
  });

  it('returns an empty array for an empty input', () => {
    expect(prioritizeSecurity([])).toEqual([]);
  });
});

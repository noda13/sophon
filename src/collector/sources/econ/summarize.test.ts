import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsArticle } from '../../../shared/schema/econ';
import { MAX_SUMMARY_ATTEMPTS } from '../../core/batch';
import { generateStructured, type LlmConfig } from '../../core/llm';
import { nextSeenIds, selectPublishedNews, summarize as summarizeWith } from './summarize';

vi.mock('../../core/llm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../core/llm')>()),
  generateStructured: vi.fn(),
}));

const generateMock = vi.mocked(generateStructured);
const CONFIG: LlmConfig = { provider: 'groq', model: 'm', apiKey: 'k' };
const sleep = vi.fn(async () => {});
const summarize = (articles: NewsArticle[]) => summarizeWith(articles, CONFIG, { sleep });

function article(id: number | string, over: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: `id${id}`,
    source: 'test',
    originalTitle: `title ${id}`,
    originalUrl: `https://e.com/${id}`,
    publishedAt: '2026-10-01T00:00:00.000Z',
    summaryJa: '',
    relevanceScore: 0,
    riskCategories: [],
    ...over,
  };
}

function result(index: number, over: Record<string, unknown> = {}) {
  return { index, summaryJa: `summary ${index}`, relevanceScore: 70, riskCategories: ['technology'], ...over };
}

// Parses through the caller's schema like the real generateStructured, so a response of the wrong shape rejects.
function respondWith(results: unknown[]) {
  generateMock.mockImplementation(async (schema) => schema.parse({ results }));
}

const promptOf = (call = 0) => generateMock.mock.calls[call]![1];

describe('summarize', () => {
  beforeEach(() => {
    generateMock.mockReset();
    sleep.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not call the LLM when every article already has a summary', async () => {
    await summarize([article(0, { summaryJa: 'done' })]);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('writes summary, score and categories back onto the articles by batch index', async () => {
    respondWith([result(0), result(1, { relevanceScore: 10, riskCategories: [] })]);
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0]).toMatchObject({ summaryJa: 'summary 0', relevanceScore: 70, riskCategories: ['technology'] });
    expect(news[1]).toMatchObject({ summaryJa: 'summary 1', relevanceScore: 10, riskCategories: [] });
  });

  it('sends only unsummarized articles to the LLM, with the configured provider', async () => {
    respondWith([result(0)]);
    await summarize([article(0, { summaryJa: 'done' }), article(1)]);
    expect(promptOf()).toBe('[0] test: title 1');
    expect(generateMock.mock.calls[0]![2]?.config).toBe(CONFIG);
  });

  it('drops invalid entries and out-of-range indexes but keeps the valid ones', async () => {
    respondWith([result(0), result(1, { relevanceScore: 150 }), result(5), result(0, { riskCategories: ['mystery'] })]);
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0]?.summaryJa).toBe('summary 0');
    expect(news[1]?.summaryJa).toBe('');
  });

  it('treats a blank summary as invalid so the article stays unsummarized instead of being marked done', async () => {
    respondWith([result(0, { summaryJa: '   ', relevanceScore: 5, riskCategories: [] }), result(1)]);
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0]).toMatchObject({ summaryJa: '', relevanceScore: 0 });
    expect(news[1]?.summaryJa).toBe('summary 1');
  });

  it('continues with the next batch when one batch fails', async () => {
    generateMock
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockImplementationOnce(async (schema) => schema.parse({ results: [result(0)] }));
    const news = Array.from({ length: 11 }, (_, i) => article(i));
    await summarize(news);
    expect(generateMock).toHaveBeenCalledTimes(2);
    expect(news[0]?.summaryJa).toBe('');
    expect(news[10]?.summaryJa).toBe('summary 0');
  });

  it('sends 10 articles per call and waits between batches', async () => {
    respondWith([]);
    await summarize(Array.from({ length: 25 }, (_, i) => article(i)));
    expect(generateMock).toHaveBeenCalledTimes(3);
    expect(promptOf(2).split('\n')).toHaveLength(5);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('processes at most 50 articles per run', async () => {
    respondWith([]);
    await summarize(Array.from({ length: 80 }, (_, i) => article(i)));
    expect(generateMock).toHaveBeenCalledTimes(5);
  });

  it('rejects a response that is not an object with a results array', async () => {
    generateMock.mockImplementation(async (schema) => schema.parse({ items: [] }));
    const news = [article(0), article(1)];
    expect(await summarize(news)).toEqual({ attempted: 2, failed: 2 });
  });

  describe('result counts', () => {
    it('returns zero counts when there is nothing to summarize', async () => {
      expect(await summarize([article(0, { summaryJa: 'done' })])).toEqual({ attempted: 0, failed: 0 });
    });

    it('counts attempted articles and those still unsummarized afterwards', async () => {
      respondWith([result(0)]);
      const news = [article(0), article(1), article(2, { summaryJa: 'done' })];
      expect(await summarize(news)).toEqual({ attempted: 2, failed: 1 });
    });

    it('counts every attempted article as failed when the batch throws', async () => {
      generateMock.mockRejectedValue(new Error('boom'));
      expect(await summarize([article(0), article(1)])).toEqual({ attempted: 2, failed: 2 });
    });

    it('caps attempted at the per-run limit', async () => {
      respondWith([]);
      expect(await summarize(Array.from({ length: 80 }, (_, i) => article(i)))).toEqual({ attempted: 50, failed: 50 });
    });
  });

  describe('retry limit', () => {
    it('increments summaryAttempts only for articles that stay unsummarized after the batch', async () => {
      respondWith([result(0), result(1, { relevanceScore: 150 })]);
      const news = [article(0), article(1), article(2, { summaryAttempts: 1 })];
      await summarize(news);
      expect(news[0]?.summaryAttempts).toBeUndefined();
      expect(news[1]?.summaryAttempts).toBe(1);
      expect(news[2]?.summaryAttempts).toBe(2);
    });

    it('increments summaryAttempts for every article in a batch that throws while other batches succeed', async () => {
      generateMock
        .mockRejectedValueOnce(new Error('boom'))
        .mockImplementationOnce(async (schema) => schema.parse({ results: [result(0)] }));
      const news = Array.from({ length: 11 }, (_, i) => article(i));
      await summarize(news);
      expect(news.slice(0, 10).map((a) => a.summaryAttempts)).toEqual(Array(10).fill(1));
      expect(news[10]?.summaryAttempts).toBeUndefined();
    });

    it('does not charge an attempt when every call fails, since that is an outage rather than a bad article', async () => {
      generateMock.mockRejectedValue(new Error('quota exceeded'));
      const news = [article(0), article(1, { summaryAttempts: 2 })];
      await summarize(news);
      expect(news.map((a) => a.summaryAttempts)).toEqual([undefined, 2]);
    });

    it('lets an article that is never summarized reach the limit over repeated runs and stop being sent', async () => {
      respondWith([]);
      const news = [article(0), article(1)];
      for (let run = 0; run < MAX_SUMMARY_ATTEMPTS; run++) await summarize(news);
      expect(news[1]?.summaryAttempts).toBe(MAX_SUMMARY_ATTEMPTS);

      generateMock.mockClear();
      await summarize([article(2), ...news]);
      expect(promptOf()).toBe('[0] test: title 2');
    });

    it('skips articles that reached the attempt limit', async () => {
      respondWith([result(0)]);
      const news = [article(0, { summaryAttempts: MAX_SUMMARY_ATTEMPTS }), article(1)];
      await summarize(news);
      expect(promptOf()).toBe('[0] test: title 1');
      expect(news[0]?.summaryAttempts).toBe(MAX_SUMMARY_ATTEMPTS);
    });

    it('does not call the LLM when every unsummarized article reached the limit', async () => {
      await summarize([article(0, { summaryAttempts: MAX_SUMMARY_ATTEMPTS })]);
      expect(generateMock).not.toHaveBeenCalled();
    });
  });
});

describe('selectPublishedNews', () => {
  it('keeps unsummarized and relevant articles and drops summarized low-relevance ones', () => {
    const news = [
      article('pending'),
      article('relevant', { summaryJa: 's', relevanceScore: 30 }),
      article('noise', { summaryJa: 's', relevanceScore: 29 }),
    ];
    expect(selectPublishedNews(news).map((a) => a.id)).toEqual(['idpending', 'idrelevant']);
  });

  it('keeps unsummarized articles below the attempt limit and drops those that reached it', () => {
    const news = [
      article('retrying', { summaryAttempts: MAX_SUMMARY_ATTEMPTS - 1 }),
      article('exhausted', { summaryAttempts: MAX_SUMMARY_ATTEMPTS }),
    ];
    expect(selectPublishedNews(news).map((a) => a.id)).toEqual(['idretrying']);
  });

  it('caps the list at 200', () => {
    expect(selectPublishedNews(Array.from({ length: 300 }, (_, i) => article(`a${i}`)))).toHaveLength(200);
  });
});

describe('nextSeenIds', () => {
  it('adds ids of dropped low-relevance articles without duplicating', () => {
    const news = [
      article('noise', { summaryJa: 's', relevanceScore: 5 }),
      article('pending'),
      article('good', { summaryJa: 's', relevanceScore: 80 }),
    ];
    expect(nextSeenIds(['old', 'idnoise'], news)).toEqual(['old', 'idnoise']);
    expect(nextSeenIds(['old'], news)).toEqual(['old', 'idnoise']);
  });

  it('adds ids of unsummarized articles that reached the attempt limit', () => {
    const news = [
      article('exhausted', { summaryAttempts: MAX_SUMMARY_ATTEMPTS }),
      article('retrying', { summaryAttempts: 1 }),
    ];
    expect(nextSeenIds(['old'], news)).toEqual(['old', 'idexhausted']);
  });

  it('keeps only the most recent 2000 ids', () => {
    const prev = Array.from({ length: 2000 }, (_, i) => `id${i}`);
    const next = nextSeenIds(prev, [article('new', { summaryJa: 's', relevanceScore: 0 })]);
    expect(next).toHaveLength(2000);
    expect(next[0]).toBe('id1');
    expect(next.at(-1)).toBe('idnew');
  });
});

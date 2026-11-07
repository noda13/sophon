import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SUMMARY_ATTEMPTS, summarize } from './summarize.js';
import { callLLM } from './llm.js';
import type { NewsArticle } from './types.js';

vi.mock('./llm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./llm.js')>()),
  callLLM: vi.fn(),
}));

const callLLMMock = vi.mocked(callLLM);

function article(id: number, over: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id: `id${id}`, source: 'test', originalTitle: `title ${id}`, originalUrl: `https://e.com/${id}`,
    publishedAt: '2026-10-01T00:00:00.000Z', summaryJa: '', relevanceScore: 0, riskCategories: [], ...over,
  };
}

function result(index: number, over: Record<string, unknown> = {}) {
  return { index, summaryJa: `summary ${index}`, relevanceScore: 70, riskCategories: ['technology'], ...over };
}

describe('summarize', () => {
  beforeEach(() => {
    callLLMMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not call the LLM when every article already has a summary', async () => {
    await summarize([article(0, { summaryJa: 'done' })]);
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it('writes summary, score and categories back onto the articles by batch index', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({ results: [result(0), result(1, { relevanceScore: 10, riskCategories: [] })] }));
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0]).toMatchObject({ summaryJa: 'summary 0', relevanceScore: 70, riskCategories: ['technology'] });
    expect(news[1]).toMatchObject({ summaryJa: 'summary 1', relevanceScore: 10, riskCategories: [] });
  });

  it('sends only unsummarized articles to the LLM', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({ results: [result(0)] }));
    await summarize([article(0, { summaryJa: 'done' }), article(1)]);
    expect(callLLMMock.mock.calls[0][1]).toBe('[0] test: title 1');
  });

  it('drops invalid entries and out-of-range indexes but keeps the valid ones', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({
      results: [result(0), result(1, { relevanceScore: 150 }), result(5), result(0, { riskCategories: ['mystery'] })],
    }));
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0].summaryJa).toBe('summary 0');
    expect(news[1].summaryJa).toBe('');
  });

  it('treats a blank summary as invalid so the article stays unsummarized instead of being marked done', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({
      results: [result(0, { summaryJa: '   ', relevanceScore: 5, riskCategories: [] }), result(1)],
    }));
    const news = [article(0), article(1)];
    await summarize(news);
    expect(news[0]).toMatchObject({ summaryJa: '', relevanceScore: 0 });
    expect(news[1].summaryJa).toBe('summary 1');
  });

  it('continues with the next batch when one batch fails', async () => {
    vi.useFakeTimers();
    callLLMMock
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(JSON.stringify({ results: [result(0)] }));
    const news = Array.from({ length: 11 }, (_, i) => article(i));
    const done = summarize(news);
    await vi.runAllTimersAsync();
    await done;
    expect(callLLMMock).toHaveBeenCalledTimes(2);
    expect(news[0].summaryJa).toBe('');
    expect(news[10].summaryJa).toBe('summary 0');
  });

  it('processes at most 50 articles per run', async () => {
    vi.useFakeTimers();
    callLLMMock.mockResolvedValue(JSON.stringify({ results: [] }));
    const done = summarize(Array.from({ length: 80 }, (_, i) => article(i)));
    await vi.runAllTimersAsync();
    await done;
    expect(callLLMMock).toHaveBeenCalledTimes(5);
  });

  describe('result counts', () => {
    it('returns zero counts when there is nothing to summarize', async () => {
      expect(await summarize([article(0, { summaryJa: 'done' })])).toEqual({ attempted: 0, failed: 0 });
    });

    it('counts attempted articles and those still unsummarized afterwards', async () => {
      callLLMMock.mockResolvedValue(JSON.stringify({ results: [result(0)] }));
      const news = [article(0), article(1), article(2, { summaryJa: 'done' })];
      expect(await summarize(news)).toEqual({ attempted: 2, failed: 1 });
    });

    it('counts every attempted article as failed when the batch throws', async () => {
      callLLMMock.mockRejectedValue(new Error('boom'));
      expect(await summarize([article(0), article(1)])).toEqual({ attempted: 2, failed: 2 });
    });

    it('caps attempted at the per-run limit', async () => {
      vi.useFakeTimers();
      callLLMMock.mockResolvedValue(JSON.stringify({ results: [] }));
      const done = summarize(Array.from({ length: 80 }, (_, i) => article(i)));
      await vi.runAllTimersAsync();
      expect(await done).toEqual({ attempted: 50, failed: 50 });
    });
  });

  describe('retry limit', () => {
    it('increments summaryAttempts only for articles that stay unsummarized after the batch', async () => {
      callLLMMock.mockResolvedValue(JSON.stringify({ results: [result(0), result(1, { relevanceScore: 150 })] }));
      const news = [article(0), article(1), article(2, { summaryAttempts: 1 })];
      await summarize(news);
      expect(news[0].summaryAttempts).toBeUndefined();
      expect(news[1].summaryAttempts).toBe(1);
      expect(news[2].summaryAttempts).toBe(2);
    });

    it('increments summaryAttempts for every article in a batch that throws', async () => {
      callLLMMock.mockRejectedValue(new Error('boom'));
      const news = [article(0), article(1)];
      await summarize(news);
      expect(news.map(a => a.summaryAttempts)).toEqual([1, 1]);
    });

    it('skips articles that reached the attempt limit', async () => {
      callLLMMock.mockResolvedValue(JSON.stringify({ results: [result(0)] }));
      const news = [article(0, { summaryAttempts: MAX_SUMMARY_ATTEMPTS }), article(1)];
      await summarize(news);
      expect(callLLMMock.mock.calls[0][1]).toBe('[0] test: title 1');
      expect(news[0].summaryAttempts).toBe(MAX_SUMMARY_ATTEMPTS);
    });

    it('does not call the LLM when every unsummarized article reached the limit', async () => {
      await summarize([article(0, { summaryAttempts: MAX_SUMMARY_ATTEMPTS })]);
      expect(callLLMMock).not.toHaveBeenCalled();
    });
  });
});

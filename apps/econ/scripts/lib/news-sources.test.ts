import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectNews, RSS_SOURCES } from './news.js';

const { parseURL } = vi.hoisted(() => ({ parseURL: vi.fn() }));

vi.mock('rss-parser', () => ({
  default: class {
    parseURL = parseURL;
  },
}));

describe('collectNews source failures', () => {
  beforeEach(() => {
    parseURL.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('rejects when every source fails', async () => {
    parseURL.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(collectNews([])).rejects.toThrow(`All ${RSS_SOURCES.length} RSS sources failed: ENOTFOUND`);
  });

  it('resolves with the successful sources when only some fail', async () => {
    let call = 0;
    parseURL.mockImplementation(async () => {
      if (call++ === 0) return { items: [{ title: 'ok', link: 'https://e.com/ok', pubDate: '2026-10-01T00:00:00Z' }] };
      throw new Error('403');
    });
    const news = await collectNews([]);
    expect(news.map(a => a.originalTitle)).toEqual(['ok']);
  });

  it('reports the names of the failed sources to the collector', async () => {
    let call = 0;
    parseURL.mockImplementation(async () => {
      if (call++ % 2 === 0) return { items: [] };
      throw new Error('403');
    });
    const failed: string[] = [];
    await collectNews([], [], failed);
    expect(failed).toEqual(RSS_SOURCES.filter((_, i) => i % 2 === 1).map(s => s.source));
  });

  it('leaves the collector empty when every source succeeds', async () => {
    parseURL.mockResolvedValue({ items: [] });
    const failed: string[] = [];
    await collectNews([], [], failed);
    expect(failed).toEqual([]);
  });
});

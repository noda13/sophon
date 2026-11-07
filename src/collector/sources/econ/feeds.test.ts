import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsArticle } from '../../../shared/schema/econ';
import { collectFeeds, validateExternalUrl, type FeedSource } from '../../core/rss';
import { ECON_FEEDS, MAX_NEWS, toNewsArticle } from './feeds';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const xml = (body: string) => new HttpResponse(body, { headers: { 'Content-Type': 'application/xml' } });
const rss = (items: Array<{ title: string; link: string; pubDate?: string }>) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://e.com</link><description>d</description>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link>${i.pubDate ? `<pubDate>${i.pubDate}</pubDate>` : ''}</item>`)
    .join('')}</channel></rss>`;

const feedPath = (feed: FeedSource) => feed.url.split('?')[0]!;

// `respond` decides per feed so a test can fail some feeds and serve others.
function serve(respond: (feed: FeedSource, index: number) => Response) {
  server.use(...ECON_FEEDS.map((feed, i) => http.get(feedPath(feed), () => respond(feed, i))));
}

function collect(existing: NewsArticle[] = [], seenIds: string[] = [], failedSources?: string[]) {
  return collectFeeds({
    sources: ECON_FEEDS,
    existing,
    toRecord: toNewsArticle,
    limit: MAX_NEWS,
    seenIds,
    failedSources,
    fetchOptions: { retries: 0 },
  });
}

function article(id: string, over: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id,
    source: 'test',
    originalTitle: `t-${id}`,
    originalUrl: `https://e.com/${id}`,
    publishedAt: '2026-10-01T00:00:00.000Z',
    summaryJa: '',
    relevanceScore: 0,
    riskCategories: [],
    ...over,
  };
}

describe('ECON_FEEDS', () => {
  it('defines the ten economy feeds with unique source names', () => {
    expect(ECON_FEEDS).toHaveLength(10);
    expect(new Set(ECON_FEEDS.map((f) => f.source)).size).toBe(ECON_FEEDS.length);
    expect(ECON_FEEDS.map((f) => f.source)).toEqual([
      'bloomberg', 'cnbc', 'marketwatch', 'wsj', 'ft', 'economist', 'fed', 'ecb', 'boj', 'nikkei',
    ]);
  });

  it('uses external https URLs only', () => {
    for (const feed of ECON_FEEDS) expect(() => validateExternalUrl(feed.url, feed.source)).not.toThrow();
    for (const feed of ECON_FEEDS) expect(feed.url.startsWith('https://')).toBe(true);
  });

  it('does not include feeds known to be unreachable', () => {
    expect(ECON_FEEDS.some((f) => /reuters/i.test(f.url) || f.source === 'reuters')).toBe(false);
  });
});

describe('toNewsArticle', () => {
  it('starts an article unsummarized, with the feed name as its source', () => {
    const item = { id: 'abc', title: 'T', url: 'https://e.com/a', publishedAt: '2026-10-02T00:00:00.000Z', summary: '' };
    expect(toNewsArticle(item, { url: 'https://e.com/rss', source: 'ft' })).toEqual({
      id: 'abc',
      source: 'ft',
      originalTitle: 'T',
      originalUrl: 'https://e.com/a',
      publishedAt: '2026-10-02T00:00:00.000Z',
      summaryJa: '',
      relevanceScore: 0,
      riskCategories: [],
    });
  });
});

describe('collecting the econ feeds', () => {
  const ok = (title: string) => xml(rss([{ title, link: `https://e.com/${title}`, pubDate: '2026-10-01T00:00:00Z' }]));

  it('rejects when every source fails', async () => {
    serve(() => new HttpResponse('', { status: 404 }));
    await expect(collect()).rejects.toThrow(`All ${ECON_FEEDS.length} RSS sources failed`);
  });

  it('resolves with the successful sources when only some fail', async () => {
    serve((_, i) => (i === 0 ? ok('ok') : new HttpResponse('', { status: 403 })));
    const news = await collect();
    expect(news.map((a) => [a.originalTitle, a.source])).toEqual([['ok', 'bloomberg']]);
  });

  it('reports the names of the failed sources to the caller', async () => {
    serve((_, i) => (i % 2 === 0 ? xml(rss([])) : new HttpResponse('', { status: 403 })));
    const failed: string[] = [];
    await collect([], [], failed);
    expect(failed).toEqual(ECON_FEEDS.filter((_, i) => i % 2 === 1).map((f) => f.source));
  });

  it('leaves the failed list empty when every source succeeds', async () => {
    serve(() => xml(rss([])));
    const failed: string[] = [];
    await collect([], [], failed);
    expect(failed).toEqual([]);
  });

  it('survives a failing source, sorts newest first and caps the list at 200', async () => {
    serve((_, i) => (i === 0 ? new HttpResponse('', { status: 500 }) : xml(rss([]))));
    const existing = Array.from({ length: 250 }, (_, i) =>
      article(`e${i}`, { publishedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }),
    );
    const result = await collect(existing);
    expect(result).toHaveLength(200);
    expect(result[0]?.id).toBe('e249');
  });

  it('reads the Nikkei feed, which is served as RDF', async () => {
    const rdf = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel rdf:about="https://e.com"><title>t</title><link>https://e.com</link><description>d</description></channel><item rdf:about="https://e.com/n1"><title>日経ニュース</title><link>https://e.com/n1</link><dc:date>2026-10-03T00:00:00+09:00</dc:date></item></rdf:RDF>`;
    serve((feed) => (feed.source === 'nikkei' ? xml(rdf) : xml(rss([]))));
    const [item] = await collect();
    expect(item).toMatchObject({
      source: 'nikkei',
      originalTitle: '日経ニュース',
      originalUrl: 'https://e.com/n1',
      publishedAt: '2026-10-02T15:00:00.000Z',
    });
  });

  it('skips ids kept in seen-ids so dropped low-relevance articles do not come back', async () => {
    serve((feed) => (feed.source === 'fed' ? ok('x') : xml(rss([]))));
    const [first] = await collect();
    expect(await collect([], [first!.id])).toHaveLength(0);
  });
});

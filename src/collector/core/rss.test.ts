import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HttpStatusError,
  MAX_RESPONSE_BYTES,
  ResponseTooLargeError,
  articleId,
  collectFeeds,
  fetchFeed,
  validateExternalUrl,
  type FeedItem,
  type FeedSource,
} from './rss';

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

const rss = (items: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://e.com</link><description>d</description>${items}</channel></rss>`;
const rssItem = (title: string, link: string, pubDate?: string) =>
  `<item><title>${title}</title><link>${link}</link>${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}</item>`;

const fast = { minRetryDelayMs: 1 };

interface Rec {
  id: string;
  source: string;
  title: string;
  publishedAt: string;
}
const toRecord = (item: FeedItem, src: FeedSource): Rec => ({
  id: item.id,
  source: src.source,
  title: item.title,
  publishedAt: item.publishedAt,
});
const rec = (id: string, publishedAt = '2026-10-01T00:00:00.000Z'): Rec => ({ id, source: 'test', title: `t-${id}`, publishedAt });

describe('articleId', () => {
  it('is a stable 16-character hex digest of url and title', () => {
    expect(articleId('https://e.com/a', 'A')).toMatch(/^[0-9a-f]{16}$/);
    expect(articleId('https://e.com/a', 'A')).toBe(articleId('https://e.com/a', 'A'));
    expect(articleId('https://e.com/a', 'A')).not.toBe(articleId('https://e.com/a', 'B'));
  });
});

describe('fetchFeed formats', () => {
  it('reads RSS 2.0', async () => {
    server.use(http.get('https://e.com/rss', () => xml(rss(rssItem('Hello', 'https://e.com/1', '2026-10-02T00:00:00Z')))));
    const [item] = await fetchFeed('https://e.com/rss');
    expect(item).toMatchObject({ title: 'Hello', url: 'https://e.com/1', publishedAt: '2026-10-02T00:00:00.000Z' });
  });

  it('reads Atom and prefers the alternate link and published date', async () => {
    server.use(
      http.get('https://e.com/atom', () =>
        xml(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>t</title><id>x</id><updated>2026-10-05T00:00:00Z</updated>
          <entry><title>Entry</title><id>1</id>
            <link href="https://e.com/self" rel="self"/><link href="https://e.com/entry" rel="alternate"/>
            <published>2026-10-01T00:00:00Z</published><updated>2026-10-03T00:00:00Z</updated></entry></feed>`),
      ),
    );
    const [item] = await fetchFeed('https://e.com/atom');
    expect(item).toMatchObject({ title: 'Entry', url: 'https://e.com/entry', publishedAt: '2026-10-01T00:00:00.000Z' });
  });

  it('reads RDF (RSS 1.0) with dc:date', async () => {
    server.use(
      http.get('https://e.com/news.rdf', () =>
        xml(`<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <channel rdf:about="https://e.com"><title>t</title><link>https://e.com</link><description>d</description></channel>
          <item rdf:about="https://e.com/r1"><title>市況</title><link>https://e.com/r1</link><dc:date>2026-10-02T09:00:00+09:00</dc:date></item></rdf:RDF>`),
      ),
    );
    const [item] = await fetchFeed('https://e.com/news.rdf');
    expect(item).toMatchObject({ title: '市況', url: 'https://e.com/r1', publishedAt: '2026-10-02T00:00:00.000Z' });
  });

  it('reads JSON Feed', async () => {
    server.use(
      http.get('https://e.com/feed.json', () =>
        HttpResponse.json({
          version: 'https://jsonfeed.org/version/1.1',
          title: 't',
          items: [{ id: '1', title: 'J', url: 'https://e.com/j', date_published: '2026-10-02T00:00:00Z' }],
        }),
      ),
    );
    const [item] = await fetchFeed('https://e.com/feed.json');
    expect(item).toMatchObject({ title: 'J', url: 'https://e.com/j' });
  });

  it('sends the configured User-Agent', async () => {
    let ua: string | null = null;
    server.use(
      http.get('https://e.com/ua', ({ request }) => {
        ua = request.headers.get('user-agent');
        return xml(rss(''));
      }),
    );
    await fetchFeed('https://e.com/ua', { userAgent: 'Test/1.0' });
    expect(ua).toBe('Test/1.0');
  });
});

describe('fetchFeed summary', () => {
  it('strips HTML from an RSS description, decodes entities and caps the length', async () => {
    const long = 'x'.repeat(600);
    server.use(
      http.get('https://e.com/rss', () =>
        xml(
          rss(
            `<item><title>A</title><link>https://e.com/a</link><description><![CDATA[<p>Tom &amp; <b>Jerry</b></p>]]></description></item>` +
              `<item><title>B</title><link>https://e.com/b</link><description>${long}</description></item>` +
              `<item><title>C</title><link>https://e.com/c</link></item>`,
          ),
        ),
      ),
    );
    const items = await fetchFeed('https://e.com/rss');
    expect(items.map((i) => i.summary)).toEqual(['Tom & Jerry', 'x'.repeat(500), '']);
  });

  it('reads an Atom summary', async () => {
    server.use(
      http.get('https://e.com/atom', () =>
        xml(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>t</title><id>x</id><updated>2026-10-05T00:00:00Z</updated>
<entry><title>E</title><id>1</id><updated>2026-10-05T00:00:00Z</updated><link href="https://e.com/e"/><summary>short text</summary></entry></feed>`),
      ),
    );
    const [item] = await fetchFeed('https://e.com/atom');
    expect(item?.summary).toBe('short text');
  });
});

describe('fetchFeed item filtering', () => {
  it('skips items without a title or link and links that are not http(s)', async () => {
    server.use(
      http.get('https://e.com/f', () =>
        xml(
          rss(
            `<item><title>no link</title></item><item><link>https://e.com/b</link></item>` +
              rssItem('script', 'javascript:alert(1)') +
              rssItem('ok', 'https://e.com/c'),
          ),
        ),
      ),
    );
    expect((await fetchFeed('https://e.com/f')).map((i) => i.title)).toEqual(['ok']);
  });

  it('keeps an item whose date is missing or invalid and falls back to the current time', async () => {
    server.use(
      http.get('https://e.com/f', () =>
        xml(rss(rssItem('bad', 'https://e.com/bad', 'not a date') + rssItem('none', 'https://e.com/none'))),
      ),
    );
    const items = await fetchFeed('https://e.com/f');
    expect(items).toHaveLength(2);
    for (const i of items) expect(Number.isNaN(new Date(i.publishedAt).getTime())).toBe(false);
  });

  it('rejects a body that is not a feed', async () => {
    server.use(http.get('https://e.com/html', () => new HttpResponse('<html><body>hi</body></html>')));
    await expect(fetchFeed('https://e.com/html')).rejects.toThrow();
  });
});

describe('fetchFeed retry and timeout', () => {
  it('retries a 429 honouring Retry-After and then succeeds', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/f', () => {
        if (calls++ === 0) return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '0' } });
        return xml(rss(rssItem('a', 'https://e.com/a')));
      }),
    );
    expect(await fetchFeed('https://e.com/f', fast)).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it('does not stack the exponential backoff on top of Retry-After', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/f', () => {
        if (calls++ === 0) return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '1' } });
        return xml(rss(rssItem('a', 'https://e.com/a')));
      }),
    );
    const started = Date.now();
    await fetchFeed('https://e.com/f', { minRetryDelayMs: 800 });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(1_600);
  });

  it('retries a 503', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/f', () => {
        if (calls++ < 2) return new HttpResponse(null, { status: 503 });
        return xml(rss(rssItem('a', 'https://e.com/a')));
      }),
    );
    expect(await fetchFeed('https://e.com/f', fast)).toHaveLength(1);
    expect(calls).toBe(3);
  });

  it('gives up after the configured number of retries', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/f', () => {
        calls++;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    await expect(fetchFeed('https://e.com/f', { ...fast, retries: 1 })).rejects.toMatchObject({ status: 500 });
    expect(calls).toBe(2);
  });

  it('does not retry a 404', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/f', () => {
        calls++;
        return new HttpResponse(null, { status: 404 });
      }),
    );
    const err = await fetchFeed('https://e.com/f', fast).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpStatusError);
    expect(calls).toBe(1);
  });

  it('retries a network error', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/f', () => {
        if (calls++ === 0) return HttpResponse.error();
        return xml(rss(rssItem('a', 'https://e.com/a')));
      }),
    );
    expect(await fetchFeed('https://e.com/f', fast)).toHaveLength(1);
  });

  it('aborts a request that exceeds the timeout', async () => {
    server.use(
      http.get('https://e.com/slow', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return xml(rss(''));
      }),
    );
    await expect(fetchFeed('https://e.com/slow', { timeoutMs: 20, retries: 0 })).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });
});

describe('fetchFeed response size cap', () => {
  it('rejects without retrying when Content-Length exceeds the cap', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/big', () => {
        calls++;
        return new HttpResponse('x', { headers: { 'Content-Length': String(MAX_RESPONSE_BYTES + 1) } });
      }),
    );
    await expect(fetchFeed('https://e.com/big', fast)).rejects.toBeInstanceOf(ResponseTooLargeError);
    expect(calls).toBe(1);
  });

  it('cuts off a streamed body without Content-Length once it passes the cap', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/stream', () => {
        calls++;
        const chunk = new Uint8Array(1024 * 1024).fill(97);
        let sent = 0;
        const body = new ReadableStream<Uint8Array>({
          pull(controller) {
            if (sent++ < 8) controller.enqueue(chunk);
            else controller.close();
          },
        });
        return new HttpResponse(body);
      }),
    );
    await expect(fetchFeed('https://e.com/stream', fast)).rejects.toBeInstanceOf(ResponseTooLargeError);
    expect(calls).toBe(1);
  });

  it('accepts a body over the default cap when maxBytes is raised', async () => {
    const big = rss(rssItem('a', 'https://e.com/a') + `<!--${'x'.repeat(MAX_RESPONSE_BYTES)}-->`);
    server.use(http.get('https://e.com/huge', () => xml(big)));
    await expect(fetchFeed('https://e.com/huge', fast)).rejects.toBeInstanceOf(ResponseTooLargeError);
    expect(await fetchFeed('https://e.com/huge', { ...fast, maxBytes: MAX_RESPONSE_BYTES * 2 })).toHaveLength(1);
  });

  it('rejects once the body passes a lowered maxBytes', async () => {
    server.use(http.get('https://e.com/small', () => xml(rss(rssItem('a', 'https://e.com/a')))));
    await expect(fetchFeed('https://e.com/small', { ...fast, maxBytes: 10 })).rejects.toMatchObject({ limitBytes: 10 });
  });

  it('accepts a body just under the cap', async () => {
    server.use(http.get('https://e.com/ok', () => xml(rss(rssItem('a', 'https://e.com/a')))));
    expect(await fetchFeed('https://e.com/ok')).toHaveLength(1);
  });
});

describe('fetchFeed signal', () => {
  it('rejects with the abort reason and does not retry when aborted mid-request', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/slow', async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 500));
        return xml(rss(''));
      }),
    );
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('stop')), 20);
    await expect(fetchFeed('https://e.com/slow', { ...fast, signal: controller.signal })).rejects.toThrow('stop');
    expect(calls).toBe(1);
  });

  it('does not issue a request when already aborted', async () => {
    let calls = 0;
    server.use(http.get('https://e.com/f', () => { calls++; return xml(rss('')); }));
    await expect(fetchFeed('https://e.com/f', { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it('interrupts the Retry-After wait', async () => {
    let calls = 0;
    server.use(
      http.get('https://e.com/f', () => {
        calls++;
        return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '10' } });
      }),
    );
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('stop')), 50);
    const started = Date.now();
    await expect(fetchFeed('https://e.com/f', { ...fast, signal: controller.signal })).rejects.toThrow('stop');
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(calls).toBe(1);
  });

  it('collectFeeds propagates its signal to every fetch', async () => {
    let calls = 0;
    server.use(http.get('https://a.test/rss', () => { calls++; return xml(rss('')); }));
    const result = await collectFeeds<FeedSource, Rec>({
      sources: [{ url: 'https://a.test/rss', source: 'a' }],
      existing: [],
      toRecord,
      limit: 10,
      signal: AbortSignal.abort(),
    }).catch((e: unknown) => e);
    expect(result).toBeInstanceOf(Error);
    expect(calls).toBe(0);
  });
});

describe('collectFeeds', () => {
  const sources: FeedSource[] = [
    { url: 'https://a.test/rss', source: 'a' },
    { url: 'https://b.test/rss', source: 'b' },
  ];
  const run = (over: Partial<Parameters<typeof collectFeeds<FeedSource, Rec>>[0]> = {}) =>
    collectFeeds<FeedSource, Rec>({
      sources,
      existing: [],
      toRecord,
      limit: 200,
      fetchOptions: { ...fast, retries: 0 },
      ...over,
    });
  const feed = (...items: string[]) => xml(rss(items.join('')));

  it('does not add the same article twice within one run, even across feeds', async () => {
    const dup = rssItem('dup', 'https://e.com/dup', '2026-10-02T00:00:00Z');
    server.use(http.get('https://a.test/rss', () => feed(dup, dup)), http.get('https://b.test/rss', () => feed(dup)));
    const result = await run();
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('a');
  });

  it('applies a per-feed maxBytes only to that feed', async () => {
    const big = () => feed(rssItem('big', 'https://e.com/big', '2026-10-02T00:00:00Z'), `<!--${'x'.repeat(MAX_RESPONSE_BYTES)}-->`);
    server.use(http.get('https://a.test/rss', big), http.get('https://b.test/rss', big));
    const failures: { source: string; reason: string }[] = [];
    const result = await run({
      sources: [
        { url: 'https://a.test/rss', source: 'a', maxBytes: MAX_RESPONSE_BYTES * 2 },
        { url: 'https://b.test/rss', source: 'b' },
      ],
      failures,
    });
    expect(result.map((r) => r.source)).toEqual(['a']);
    expect(failures).toEqual([{ source: 'b', reason: 'response too large' }]);
  });

  it('skips articles already in the existing list or the seen-id set', async () => {
    const item = rssItem('x', 'https://e.com/x', '2026-10-02T00:00:00Z');
    server.use(http.get('https://a.test/rss', () => feed(item)), http.get('https://b.test/rss', () => feed()));
    const [first] = await run();
    expect(await run({ existing: [first!] })).toHaveLength(1);
    expect(await run({ seenIds: [first!.id] })).toHaveLength(0);
  });

  it('survives a failing source, reports it, and sorts newest first within the limit', async () => {
    server.use(
      http.get('https://a.test/rss', () => new HttpResponse(null, { status: 403 })),
      http.get('https://b.test/rss', () =>
        feed(rssItem('old', 'https://e.com/old', '2026-10-01T00:00:00Z'), rssItem('new', 'https://e.com/new', '2026-10-03T00:00:00Z')),
      ),
    );
    const failed: string[] = [];
    const existing = [rec('e1', '2026-10-02T00:00:00.000Z')];
    const result = await run({ existing, failedSources: failed, limit: 2 });
    expect(failed).toEqual(['a']);
    expect(result.map((r) => r.title)).toEqual(['new', 't-e1']);
  });

  it('leaves failedSources empty when every source succeeds', async () => {
    server.use(http.get('https://a.test/rss', () => feed()), http.get('https://b.test/rss', () => feed()));
    const failed: string[] = [];
    await run({ failedSources: failed });
    expect(failed).toEqual([]);
  });

  it('throws when every source fails and names the distinct reasons', async () => {
    server.use(
      http.get('https://a.test/rss', () => new HttpResponse(null, { status: 403 })),
      http.get('https://b.test/rss', () => new HttpResponse(null, { status: 403 })),
    );
    const failed: string[] = [];
    await expect(run({ failedSources: failed })).rejects.toThrow(
      'All 2 RSS sources failed: HTTP 403 for https://a.test/rss; HTTP 403 for https://b.test/rss',
    );
    expect(failed).toEqual(['a', 'b']);
  });

  it('passes the source definition to toRecord so callers can carry extra fields', async () => {
    server.use(http.get('https://a.test/rss', () => feed(rssItem('x', 'https://e.com/x'))));
    const result = await collectFeeds({
      sources: [{ url: 'https://a.test/rss', source: 'a', hint: 'ai' }],
      existing: [],
      limit: 10,
      toRecord: (item, src) => ({ id: item.id, publishedAt: item.publishedAt, hint: src.hint }),
      fetchOptions: { retries: 0 },
    });
    expect(result[0]!.hint).toBe('ai');
  });
});

describe('validateExternalUrl', () => {
  it('accepts public https URLs and localhost over http', () => {
    expect(() => validateExternalUrl('https://rsshub.example.com', 'X')).not.toThrow();
    expect(() => validateExternalUrl('http://localhost:1200', 'X')).not.toThrow();
    expect(() => validateExternalUrl('http://127.0.0.1:1200', 'X')).not.toThrow();
  });

  it('rejects a malformed URL', () => {
    expect(() => validateExternalUrl('not a url', 'RSSHUB_URL')).toThrow('RSSHUB_URL is not a valid URL');
  });

  it('rejects plain http for non-local hosts', () => {
    expect(() => validateExternalUrl('http://example.com', 'X')).toThrow('must use https');
  });

  it.each([
    'https://10.0.0.1',
    'https://172.16.0.1',
    'https://172.31.255.1',
    'https://192.168.1.1',
    'https://169.254.169.254',
    'https://[fc00::1]',
    'https://[fd12::1]',
    'https://[fe80::1]',
  ])('rejects the private address %s', (url) => {
    expect(() => validateExternalUrl(url, 'X')).toThrow('private/internal address');
  });

  it('does not treat 172.32.x as private', () => {
    expect(() => validateExternalUrl('https://172.32.0.1', 'X')).not.toThrow();
  });
});

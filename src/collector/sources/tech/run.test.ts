import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArticlesFileSchema,
  DigestIndexSchema,
  DigestSchema,
  EolFileSchema,
  type Article,
  type Digest,
} from '../../../shared/schema/tech';
import { readJson } from '../../core/io';
import { LLM_DISABLED_ERROR } from '../../core/llm';
import type { RunContext } from '../../core/source';
import type { TechFeed } from './feeds';
import { runTech, source } from './run';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const now = new Date('2026-11-07T03:00:00.000Z');

const feeds: TechFeed[] = [
  { url: 'https://feeds.test/a.xml', source: 'feed-a', hint: 'trend' },
  { url: 'https://feeds.test/b.xml', source: 'feed-b', hint: 'security' },
  { url: 'https://feeds.test/gone.xml', source: 'feed-gone', hint: 'ai' },
];
const eolProducts = [
  { id: 'nodejs', label: 'Node.js' },
  { id: 'go', label: 'Go' },
];
const fast = {
  feeds,
  eolProducts,
  fetchOptions: { minRetryDelayMs: 1, retries: 0 },
  eolOptions: { minRetryDelayMs: 1, retries: 0 },
  batchIntervalMs: 0,
};

const rss = (items: Array<[string, string, string]>) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://e.com</link><description>d</description>${items
    .map(([t, l, d]) => `<item><title>${t}</title><link>${l}</link><pubDate>${d}</pubDate></item>`)
    .join('')}</channel></rss>`;
const xml = (body: string) => new HttpResponse(body, { headers: { 'Content-Type': 'application/xml' } });

const groqReply = (content: unknown) =>
  HttpResponse.json({
    id: 'c1',
    object: 'chat.completion',
    created: 0,
    model: 'llama-3.3-70b-versatile',
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(content) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
const groqError = () => HttpResponse.json({ error: { message: 'bad request' } }, { status: 400 });

interface GroqBody {
  messages: Array<{ role: string; content: string }>;
}
const isDigestRequest = (body: GroqBody) =>
  body.messages.some((m) => m.role === 'system' && m.content.includes('ダイジェスト'));
const userText = (body: GroqBody) => body.messages.find((m) => m.role === 'user')!.content;

const summarizeAll = (body: GroqBody) => {
  const n = userText(body).split('\n').length;
  return groqReply({
    results: Array.from({ length: n }, (_, index) => ({
      index,
      summaryJa: `要約${index}`,
      category: 'ai',
      importance: index === 0 ? '高' : '中',
    })),
  });
};
const digestReply = () =>
  groqReply({
    overviewJa: '今日の概要',
    sections: [
      {
        category: 'ai',
        highlights: [
          { index: 0 },
          { index: 99 },
        ],
      },
    ],
  });

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let dir: string;
const ctx = (env: NodeJS.ProcessEnv = {}): RunContext => ({ dir, now, env });
const llmEnv = { GROQ_API_KEY: 'test-key' };
const prevDigest: Digest = {
  date: '2026-11-06',
  generatedAt: '2026-11-06T03:00:00.000Z',
  overviewJa: '前日',
  sections: [],
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tech-run-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(
    http.get('https://feeds.test/a.xml', () =>
      xml(
        rss([
          ['Alpha', 'https://e.com/alpha', 'Fri, 06 Nov 2026 10:00:00 GMT'],
          ['Beta', 'https://e.com/beta', 'Fri, 06 Nov 2026 09:00:00 GMT'],
        ]),
      ),
    ),
    http.get('https://feeds.test/b.xml', () =>
      xml(rss([['Gamma CVE', 'https://e.com/gamma', 'Fri, 06 Nov 2026 08:00:00 GMT']])),
    ),
    http.get('https://feeds.test/gone.xml', () => new HttpResponse(null, { status: 404 })),
    http.get('https://endoflife.date/api/nodejs.json', () =>
      HttpResponse.json([{ cycle: '24', eol: '2028-04-30', latest: '24.1.0' }]),
    ),
    http.get('https://endoflife.date/api/go.json', () => new HttpResponse(null, { status: 503 })),
  );
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

const useManyArticles = (count: number) =>
  server.use(
    http.get('https://feeds.test/a.xml', () =>
      xml(
        rss(
          Array.from({ length: count }, (_, i): [string, string, string] => [
            `Item ${i}`,
            `https://e.com/item-${i}`,
            new Date(Date.UTC(2026, 10, 6, 23 - i)).toUTCString(),
          ]),
        ),
      ),
    ),
  );

const readArticles = () => readJson(dir, 'articles.json', ArticlesFileSchema, []);
const readLatestDigest = () => readJson(dir, 'digest-latest.json', DigestSchema, null as never);

describe('tech source', () => {
  it('is registered under the tech id', () => {
    expect(source.id).toBe('tech');
  });
});

describe('runTech without an LLM key', () => {
  it('collects articles and EOL, skips AI processing and reports failures', async () => {
    const result = await runTech(ctx(), fast);

    expect(result.counts).toMatchObject({
      articles: 3,
      newArticles: 3,
      failedSources: 1,
      eol: 1,
      failedEolProducts: 1,
      llmSkipped: 1,
      summarized: 0,
      digest: 0,
    });
    expect(result.errors).toEqual(['RSS failed: feed-gone (HTTP 404)', 'EOL failed: Go (HTTP 503)', LLM_DISABLED_ERROR]);
    expect(result.forceFailed).toBe(true);

    const articles = readArticles();
    expect(articles.map((a) => a.originalTitle)).toEqual(['Alpha', 'Beta', 'Gamma CVE']);
    expect(articles.every((a) => a.summaryJa === '' && a.importance === '中')).toBe(true);
    expect(articles.find((a) => a.source === 'feed-b')!.category).toBe('security');
    expect(readJson(dir, 'eol.json', EolFileSchema, [])).toHaveLength(1);
    expect(readdirSync(dir).sort()).toEqual(['articles.json', 'eol.json']);
  });

  it('keeps earlier summaries and the previous digest, and does not duplicate known articles', async () => {
    await runTech(ctx(), fast);
    const summarized: Article[] = readArticles().map((a) => ({ ...a, summaryJa: '前回の要約', importance: '高' }));
    writeFileSync(join(dir, 'articles.json'), JSON.stringify(summarized));
    writeFileSync(join(dir, 'digest-latest.json'), JSON.stringify(prevDigest));

    const result = await runTech(ctx(), fast);

    expect(result.counts.newArticles).toBe(0);
    expect(readArticles()).toEqual(summarized);
    expect(readLatestDigest()).toEqual(prevDigest);
  });

  it('throws when every feed fails, leaving existing files untouched', async () => {
    server.use(
      http.get('https://feeds.test/a.xml', () => new HttpResponse(null, { status: 404 })),
      http.get('https://feeds.test/b.xml', () => new HttpResponse(null, { status: 404 })),
    );
    await expect(runTech(ctx(), fast)).rejects.toThrow(/All 3 RSS sources failed/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('refuses to overwrite an articles.json with an unexpected shape', async () => {
    writeFileSync(join(dir, 'articles.json'), JSON.stringify([{ id: 1 }]));
    await expect(runTech(ctx(), fast)).rejects.toThrow(/unexpected shape/);
  });
});

describe('runTech with an LLM key', () => {
  it('summarizes, classifies, and writes the latest and dated digests', async () => {
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as GroqBody;
        return isDigestRequest(body) ? digestReply() : summarizeAll(body);
      }),
    );

    const result = await runTech(ctx(llmEnv), fast);

    expect(result.counts).toMatchObject({ summarized: 3, summaryFailed: 0, digest: 1, llmSkipped: 0 });
    expect(result.forceFailed).toBe(false);
    expect(result.errors).not.toContain(LLM_DISABLED_ERROR);
    expect(result.errors).toEqual(['RSS failed: feed-gone (HTTP 404)', 'EOL failed: Go (HTTP 503)']);
    const articles = readArticles();
    expect(articles.every((a) => a.summaryJa.startsWith('要約') && a.category === 'ai')).toBe(true);
    expect(articles.some((a) => 'summaryAttempts' in a)).toBe(false);

    const latest = readLatestDigest();
    expect(latest).toMatchObject({ date: '2026-11-07', overviewJa: '今日の概要' });
    expect(latest.sections[0]!.highlights).toEqual([{ title: 'Alpha', summaryJa: '要約0', url: 'https://e.com/alpha' }]);
    expect(readJson(dir, 'digest/2026-11-07.json', DigestSchema, null as never)).toEqual(latest);
    expect(readJson(dir, 'digest/index.json', DigestIndexSchema, null as never)).toEqual({ dates: ['2026-11-07'] });
  });

  it('rebuilds the digest index from every dated digest on disk', async () => {
    mkdirSync(join(dir, 'digest'));
    for (const date of ['2026-11-04', '2026-11-06']) {
      writeFileSync(join(dir, 'digest', `${date}.json`), JSON.stringify({ ...prevDigest, date }));
    }
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as GroqBody;
        return isDigestRequest(body) ? digestReply() : summarizeAll(body);
      }),
    );

    await runTech(ctx(llmEnv), fast);

    expect(readJson(dir, 'digest/index.json', DigestIndexSchema, null as never).dates).toEqual([
      '2026-11-07',
      '2026-11-06',
      '2026-11-04',
    ]);
  });

  it('keeps summaryAttempts unchanged and builds no digest when every LLM call fails', async () => {
    server.use(http.post(GROQ_URL, () => groqError()));

    const result = await runTech(ctx(llmEnv), fast);

    expect(result.counts).toMatchObject({ summarized: 0, summaryFailed: 3, digest: 0 });
    expect(result.errors.some((e) => e.startsWith('summarize batch 1 failed'))).toBe(true);
    expect(readArticles().some((a) => 'summaryAttempts' in a)).toBe(false);
    expect(readdirSync(dir)).not.toContain('digest-latest.json');
  });

  it('counts a failed attempt only for the batch that failed when another batch succeeds', async () => {
    useManyArticles(12);
    let summaryCalls = 0;
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as GroqBody;
        if (isDigestRequest(body)) return digestReply();
        return summaryCalls++ === 0 ? groqError() : summarizeAll(body);
      }),
    );

    const result = await runTech(ctx(llmEnv), fast);

    expect(result.counts).toMatchObject({ summarized: 3, summaryFailed: 10 });
    const articles = readArticles();
    expect(articles.filter((a) => a.summaryJa === '')).toHaveLength(10);
    expect(articles.filter((a) => a.summaryJa === '').every((a) => a.summaryAttempts === 1)).toBe(true);
  });

  it('adopts the valid entries when one entry violates an enum', async () => {
    useManyArticles(9);
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as GroqBody;
        if (isDigestRequest(body)) return digestReply();
        const n = userText(body).split('\n').length;
        return groqReply({
          results: Array.from({ length: n }, (_, index) => ({
            index,
            summaryJa: `要約${index}`,
            category: index === 3 ? 'bogus' : 'ai',
            importance: '中',
          })),
        });
      }),
    );

    const result = await runTech(ctx(llmEnv), fast);

    expect(result.counts).toMatchObject({ summarized: 9, summaryFailed: 1 });
    const articles = readArticles();
    expect(articles.filter((a) => a.summaryJa !== '')).toHaveLength(9);
    const [rejected] = articles.filter((a) => a.summaryJa === '');
    expect(rejected).toMatchObject({ summaryAttempts: 1 });
    expect(result.errors).toContain('summarize: dropped 1 invalid entries');
  });

  it('keeps the summaries of finished batches on disk when the run is aborted mid-LLM', async () => {
    useManyArticles(25);
    const controller = new AbortController();
    let summaryCalls = 0;
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as GroqBody;
        if (++summaryCalls === 2) controller.abort();
        return summarizeAll(body);
      }),
    );

    await expect(runTech({ ...ctx(llmEnv), signal: controller.signal }, fast)).rejects.toThrow();

    const articles = readArticles();
    expect(articles).toHaveLength(26);
    expect(articles.filter((a) => a.summaryJa !== '').length).toBeGreaterThanOrEqual(10);
    expect(readdirSync(dir)).not.toContain('eol.json');
  });

  it('stops retrying an article after three failed attempts', async () => {
    await runTech(ctx(), fast);
    const seeded = readArticles().map((a, i) => (i === 0 ? { ...a, summaryAttempts: 3 } : a));
    writeFileSync(join(dir, 'articles.json'), JSON.stringify(seeded));
    const summaryRequests: string[] = [];
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as GroqBody;
        if (isDigestRequest(body)) return digestReply();
        summaryRequests.push(userText(body));
        return summarizeAll(body);
      }),
    );

    const result = await runTech(ctx(llmEnv), fast);

    expect(summaryRequests).toHaveLength(1);
    expect(summaryRequests[0]!.split('\n')).toHaveLength(2);
    expect(summaryRequests[0]).not.toContain(seeded[0]!.originalTitle);
    expect(result.counts.summarized).toBe(2);
    expect(readArticles()[0]).toMatchObject({ summaryJa: '', summaryAttempts: 3 });
  });

  it('keeps the previous digest and reports an error when only the digest call fails', async () => {
    writeFileSync(join(dir, 'digest-latest.json'), JSON.stringify(prevDigest));
    server.use(
      http.post(GROQ_URL, async ({ request }) => {
        const body = (await request.json()) as GroqBody;
        return isDigestRequest(body) ? groqError() : summarizeAll(body);
      }),
    );

    const result = await runTech(ctx(llmEnv), fast);

    expect(result.counts).toMatchObject({ summarized: 3, digest: 0 });
    expect(result.errors.some((e) => e.startsWith('digest failed'))).toBe(true);
    expect(readLatestDigest()).toEqual(prevDigest);
    expect(readArticles().every((a) => a.summaryJa !== '')).toBe(true);
  });
});

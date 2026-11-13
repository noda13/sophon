import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLM_DISABLED_ERROR } from '../../core/llm';
import { buildFeeds, issueId, newIssue } from './feeds';
import { createSource } from './run';
import {
  CategorySummaryFileSchema,
  IdeasFileSchema,
  IssuesFileSchema,
  type Issue,
} from '../../../shared/schema/issue';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const now = new Date('2026-11-07T00:00:00.000Z');

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'issue-run-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const RSSHUB_ENV = { RSSHUB_URL: 'https://rsshub.example.com' };
const feeds = buildFeeds(RSSHUB_ENV);

interface Entry {
  title: string;
  link: string;
  date: string;
}

const rss = (entries: Entry[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${entries
    .map((e) => `<item><title>${e.title}</title><link>${e.link}</link><pubDate>${e.date}</pubDate></item>`)
    .join('')}</channel></rss>`;

// feed ごとに 1 件。publishedAt を feed の並び順でずらし、並べ替え結果を決定的にする。
function entriesFor(source: string, count = 1): Entry[] {
  const base = feeds.findIndex((f) => f.source === source);
  return Array.from({ length: count }, (_, i) => ({
    title: `${source} headline ${i}`,
    link: `https://example.com/${source}/${i}`,
    date: new Date(Date.UTC(2026, 10, 6, 12 - base, 0, -i)).toUTCString(),
  }));
}

function mockFeeds(opts: { failing?: string[]; perFeed?: number } = {}) {
  server.use(
    ...feeds.map((f) =>
      http.get(f.url, () =>
        opts.failing?.includes(f.source)
          ? new HttpResponse(null, { status: 404 })
          : new HttpResponse(rss(entriesFor(f.source, opts.perFeed)), { headers: { 'Content-Type': 'application/xml' } }),
      ),
    ),
  );
}

const chat = (content: unknown) =>
  HttpResponse.json({
    id: 'c',
    object: 'chat.completion',
    created: 0,
    model: 'openai/gpt-oss-120b',
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(content) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

interface ChatBody {
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
}

type LlmHook = (kind: 'classify' | 'idea', callNumber: number, body: ChatBody) => Response | undefined;

// index 0 は appifiability 80（アイデア対象）、それ以外は 30。
function mockLlm(hook?: LlmHook) {
  const calls = { classify: 0, idea: 0 };
  server.use(
    http.post(GROQ_URL, async ({ request }) => {
      const body = (await request.json()) as ChatBody;
      const { messages } = body;
      const system = messages.find((m) => m.role === 'system')?.content ?? '';
      const user = messages.find((m) => m.role === 'user')?.content ?? '';
      if (system.includes('社会課題アナリスト')) {
        calls.classify++;
        const hooked = hook?.('classify', calls.classify, body);
        if (hooked) return hooked;
        const items = JSON.parse(user) as Array<{ index: number }>;
        return chat({
          results: items.map(({ index }) => ({
            index,
            summaryJa: `要約${index}`,
            category: index % 2 === 0 ? 'aging_care' : 'not-a-category',
            severityScore: index === 0 ? 120 : 50,
            urgencyScore: 40,
            appifiabilityScore: index === 0 ? 80 : 30,
            affectedDomain: ['高齢者'],
          })),
        });
      }
      calls.idea++;
      const hooked = hook?.('idea', calls.idea, body);
      if (hooked) return hooked;
      return chat({ proposedAppIdea: '見守りアプリ', mvpFeatures: ['通知'], targetUsers: '家族', difficulty: 'low' });
    }),
  );
  return calls;
}

const read = <T>(file: string): T => JSON.parse(readFileSync(join(dir, file), 'utf-8')) as T;
const ctx = (env: NodeJS.ProcessEnv = {}) => ({ dir, now, env: { ...RSSHUB_ENV, ...env } });
const source = createSource({ sleep: async () => {}, llmMaxAttempts: 1 });

function seed(issues: Issue[]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'issues.json'), JSON.stringify(issues));
}

const oldIssue = (n: number, over: Partial<Issue> = {}): Issue => ({
  ...newIssue(
    {
      id: 'x',
      title: `old ${n}`,
      url: `https://example.com/old/${n}`,
      publishedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, -n)).toISOString(),
      summary: '',
    },
    { url: 'https://example.com/feed', source: 'nhk', sourceType: 'news_jp' },
    new Date('2026-01-01T00:00:00.000Z'),
  ),
  ...over,
});

describe('issue source without an LLM key', () => {
  it('collects, skips classification, and writes schema-valid files', async () => {
    mockFeeds({ failing: ['x_jijicom'] });
    const result = await source.run(ctx());

    expect(result.counts).toMatchObject({ issues: 8, newIssues: 8, failedSources: 1, classified: 0, llmSkipped: 1, ideas: 0 });
    expect(result.errors).toEqual(['RSS failed: x_jijicom (HTTP 404)', LLM_DISABLED_ERROR]);
    expect(result.forceFailed).toBe(true);
    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.every((i) => i.classifiedAt === null && i.category === '')).toBe(true);
    expect(IdeasFileSchema.parse(read('ideas.json'))).toEqual([]);
    expect(CategorySummaryFileSchema.parse(read('category-summary.json'))).toEqual([]);
  });

  it('carries previous classification and ideas over untouched', async () => {
    const kept = oldIssue(1, {
      id: 'legacy-id',
      category: 'education',
      appifiabilityScore: 75,
      severityScore: 60,
      classifiedAt: '2026-01-01T00:00:00.000Z',
      proposedAppIdea: '案',
      ideaGeneratedAt: '2026-01-01T00:00:00.000Z',
    });
    seed([kept]);
    mockFeeds();
    await source.run(ctx());

    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.find((i) => i.id === 'legacy-id')).toEqual(kept);
    expect(IdeasFileSchema.parse(read('ideas.json')).map((i) => i.id)).toEqual(['legacy-id']);
    expect(CategorySummaryFileSchema.parse(read('category-summary.json'))).toEqual([
      { category: 'education', count: 1, avgSeverity: 60, avgAppifiability: 75 },
    ]);
  });

  it('does not duplicate an article whose legacy 32-char id is already stored', async () => {
    const [feed] = feeds;
    const [entry] = entriesFor(feed!.source);
    seed([oldIssue(1, { id: issueId(entry!.link, entry!.title), originalUrl: entry!.link, originalTitle: entry!.title })]);
    mockFeeds();
    const result = await source.run(ctx());

    expect(result.counts.issues).toBe(feeds.length);
    expect(result.counts.newIssues).toBe(feeds.length - 1);
  });

  it('keeps only the newest 300 issues', async () => {
    seed(Array.from({ length: 295 }, (_, n) => oldIssue(n)));
    mockFeeds({ perFeed: 2 });
    const result = await source.run(ctx());

    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues).toHaveLength(300);
    expect(result.counts.issues).toBe(300);
    expect(issues.filter((i) => i.originalUrl.includes('/old/'))).toHaveLength(300 - feeds.length * 2);
    const times = issues.map((i) => Date.parse(i.publishedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('throws when every feed fails so the run is not recorded as a success', async () => {
    mockFeeds({ failing: feeds.map((f) => f.source) });
    await expect(source.run(ctx())).rejects.toThrow(/All \d+ RSS sources failed/);
  });
});

describe('issue source with an LLM key', () => {
  const env = { GROQ_API_KEY: 'k' };

  it('classifies, clamps scores, normalizes categories, and generates ideas for score >= 60', async () => {
    mockFeeds();
    const calls = mockLlm();
    const result = await source.run(ctx(env));

    expect(calls).toEqual({ classify: 1, idea: 1 });
    expect(result.counts).toMatchObject({ issues: 9, classified: 9, classifyFailed: 0, ideasGenerated: 1, ideas: 1, llmSkipped: 0 });
    expect(result.errors).toEqual([]);
    expect(result.forceFailed).toBe(false);

    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.every((i) => i.classifiedAt === now.toISOString())).toBe(true);
    expect(Math.max(...issues.map((i) => i.severityScore))).toBe(100);
    expect(issues.map((i) => i.category).sort()).toEqual(
      ['aging_care', 'aging_care', 'aging_care', 'aging_care', 'aging_care', 'governance', 'governance', 'governance', 'governance'],
    );
    const ideas = IdeasFileSchema.parse(read('ideas.json'));
    expect(ideas).toHaveLength(1);
    expect(ideas[0]).toMatchObject({ proposedAppIdea: '見守りアプリ', difficulty: 'low', ideaGeneratedAt: now.toISOString() });
    expect(CategorySummaryFileSchema.parse(read('category-summary.json')).reduce((n, s) => n + s.count, 0)).toBe(9);
  });

  it('records failures, keeps the attempts untouched when every batch fails, and still writes valid output', async () => {
    mockFeeds();
    server.use(http.post(GROQ_URL, () => new HttpResponse('boom', { status: 500 })));
    const result = await source.run(ctx(env));

    expect(result.counts).toMatchObject({ classified: 0, classifyFailed: 9 });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^classify batch 1:/);
    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.every((i) => !i.classifyAttempts && i.classifiedAt === null)).toBe(true);
  });

  it('stops retrying an issue after 3 failed attempts', async () => {
    seed([oldIssue(1, { classifyAttempts: 3 })]);
    mockFeeds({ failing: feeds.slice(1).map((f) => f.source) });
    const calls = mockLlm();
    const result = await source.run(ctx(env));

    expect(calls.classify).toBe(1);
    expect(result.counts.classified).toBe(1);
    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.find((i) => i.originalUrl.includes('/old/'))?.classifiedAt).toBeNull();
  });

  const classifyBody = (body: ChatBody) => JSON.parse(body.messages.find((m) => m.role === 'user')!.content) as Array<{ index: number }>;
  const classifyAll = (items: Array<{ index: number }>) =>
    chat({
      results: items.map(({ index }) => ({
        index,
        summaryJa: `要約${index}`,
        category: 'aging_care',
        severityScore: 50,
        urgencyScore: 40,
        appifiabilityScore: index === 0 ? 80 : 30,
        affectedDomain: ['高齢者'],
      })),
    });

  it('charges an attempt only to the failed batch when another batch succeeds', async () => {
    mockFeeds({ perFeed: 2 });
    mockLlm((kind, n, body) => {
      if (kind !== 'classify') return undefined;
      return n === 1 ? new HttpResponse('boom', { status: 500 }) : classifyAll(classifyBody(body));
    });
    const result = await source.run(ctx(env));

    expect(result.counts).toMatchObject({ issues: 18, classified: 8, classifyFailed: 10 });
    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.filter((i) => i.classifyAttempts === 1)).toHaveLength(10);
    expect(issues.filter((i) => i.classifiedAt !== null)).toHaveLength(8);
    expect(issues.filter((i) => i.classifiedAt !== null).every((i) => !i.classifyAttempts)).toBe(true);
  });

  it('drops one invalid entry instead of failing the whole batch', async () => {
    mockFeeds();
    mockLlm((kind, _n, body) => {
      if (kind !== 'classify') return undefined;
      const items = classifyBody(body);
      return chat({
        results: items.map(({ index }) => ({
          index,
          summaryJa: index === 3 ? '' : `要約${index}`,
          category: 'aging_care',
          severityScore: 50,
          urgencyScore: 40,
          appifiabilityScore: 30,
          affectedDomain: [],
        })),
      });
    });
    const result = await source.run(ctx(env));

    expect(result.counts).toMatchObject({ classified: 8, classifyFailed: 1 });
    expect(result.errors).toEqual([]);
    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.filter((i) => i.classifiedAt === null)).toHaveLength(1);
    expect(issues.find((i) => i.classifiedAt === null)?.classifyAttempts).toBe(1);
  });

  it('writes issues.json and ideas.json after each batch so a later timeout keeps the earlier work', async () => {
    mockFeeds({ perFeed: 2 });
    const seenOnDisk: { classifiedBeforeBatch2?: number; ideasBeforeIdea2?: number } = {};
    mockLlm((kind, n, body) => {
      if (kind === 'classify' && n === 2) {
        seenOnDisk.classifiedBeforeBatch2 = IssuesFileSchema.parse(read('issues.json')).filter((i) => i.classifiedAt).length;
        return classifyAll(classifyBody(body));
      }
      if (kind === 'idea' && n === 2) {
        seenOnDisk.ideasBeforeIdea2 = IdeasFileSchema.parse(read('ideas.json')).length;
      }
      return undefined;
    });
    await source.run(ctx(env));

    expect(seenOnDisk).toEqual({ classifiedBeforeBatch2: 10, ideasBeforeIdea2: 1 });
    expect(IdeasFileSchema.parse(read('ideas.json'))).toHaveLength(2);
  });

  it('defers the rest to the next run, without charging attempts, once the LLM budget is spent', async () => {
    mockFeeds({ perFeed: 2 });
    let clockMs = 0;
    const budgeted = createSource({ sleep: async () => {}, llmMaxAttempts: 1, llmBudgetMs: 1_000, clock: () => clockMs });
    const calls = mockLlm((kind, _n, body) => {
      if (kind !== 'classify') return undefined;
      clockMs += 2_000;
      return classifyAll(classifyBody(body));
    });
    const result = await budgeted.run(ctx(env));

    expect(calls).toEqual({ classify: 1, idea: 0 });
    expect(result.counts).toMatchObject({ classified: 10, classifyFailed: 0, ideasGenerated: 0, ideaFailed: 0, llmDeferred: 9 });
    expect(result.errors).toEqual(['LLM budget exceeded: 9 items deferred to next run']);
    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.filter((i) => i.classifiedAt === null)).toHaveLength(8);
    expect(issues.every((i) => !i.classifyAttempts && !i.ideaAttempts)).toBe(true);
  });

  it('caps the output size of classify and idea calls', async () => {
    mockFeeds();
    const limits: Record<string, number | undefined> = {};
    mockLlm((kind, _n, body) => {
      limits[kind] = body.max_tokens;
      return undefined;
    });
    await source.run(ctx(env));

    expect(limits).toEqual({ classify: 8192, idea: 2048 });
  });

  it('stops at the next batch when the run signal aborts', async () => {
    mockFeeds({ perFeed: 2 });
    const controller = new AbortController();
    const calls = mockLlm((kind, _n, body) => {
      if (kind !== 'classify') return undefined;
      controller.abort(new Error('run timed out'));
      return classifyAll(classifyBody(body));
    });
    await expect(source.run({ ...ctx(env), signal: controller.signal })).rejects.toThrow('run timed out');
    expect(calls).toEqual({ classify: 1, idea: 0 });
  });
});

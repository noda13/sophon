import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
    model: 'llama-3.3-70b-versatile',
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(content) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

interface ChatBody {
  messages: Array<{ role: string; content: string }>;
}

// index 0 は appifiability 80（アイデア対象）、それ以外は 30。
function mockLlm() {
  const calls = { classify: 0, idea: 0 };
  server.use(
    http.post(GROQ_URL, async ({ request }) => {
      const { messages } = (await request.json()) as ChatBody;
      const system = messages.find((m) => m.role === 'system')?.content ?? '';
      const user = messages.find((m) => m.role === 'user')?.content ?? '';
      if (system.includes('社会課題アナリスト')) {
        calls.classify++;
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
    expect(result.errors).toEqual(['feed failed: x_jijicom']);
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

  it('records failures, counts the attempt, and still writes valid output', async () => {
    mockFeeds();
    server.use(http.post(GROQ_URL, () => new HttpResponse('boom', { status: 500 })));
    const result = await source.run(ctx(env));

    expect(result.counts).toMatchObject({ classified: 0, classifyFailed: 9 });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^classify batch 1:/);
    const issues = IssuesFileSchema.parse(read('issues.json'));
    expect(issues.every((i) => i.classifyAttempts === 1 && i.classifiedAt === null)).toBe(true);
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
});

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CompositeRiskSchema,
  EventsFileSchema,
  IndicatorsFileSchema,
  NewsFileSchema,
  RISK_CATEGORIES,
  RiskHistoryFileSchema,
  RisksFileSchema,
  type CompositeRisk,
  type NewsArticle,
  type RiskAssessment,
  type RiskCategory,
} from '../../../shared/schema/econ';
import { LLM_DISABLED_ERROR } from '../../core/llm';
import { ECON_FEEDS } from './feeds';
import { ASSETS } from './indicators';
import { source } from './run';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const KEYED = { GROQ_API_KEY: 'test-key' };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sophon-econ-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const xml = (body: string) => new HttpResponse(body, { headers: { 'Content-Type': 'application/xml' } });
const rss = (title: string, link: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://e.com</link><description>d</description><item><title>${title}</title><link>${link}</link><pubDate>Fri, 06 Nov 2026 09:00:00 GMT</pubDate></item></channel></rss>`;

const groqReply = (content: unknown) =>
  HttpResponse.json({
    id: 'chatcmpl-1',
    object: 'chat.completion',
    created: 0,
    model: 'llama-3.3-70b-versatile',
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(content) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

const yahooReply = (price: number) =>
  HttpResponse.json({
    chart: { result: [{ meta: { regularMarketPrice: price }, indicators: { quote: [{ close: [price - 1, price] }] } }] },
  });

type GroqKind = 'summarize' | 'assess';

interface World {
  feed?: (source: string) => Response;
  yahoo?: (symbol: string) => Response;
  /** Omit to make any LLM call fail the test as an unhandled request. */
  groq?: (kind: GroqKind, prompt: string) => Response;
}

function useWorld(world: World = {}) {
  const feed = world.feed ?? ((s) => xml(rss(`${s} headline`, `https://e.com/${s}`)));
  server.use(
    ...ECON_FEEDS.map((f) => http.get(f.url.split('?')[0]!, () => feed(f.source))),
    http.get('https://query1.finance.yahoo.com/v8/finance/chart/:symbol', ({ params }) =>
      (world.yahoo ?? (() => yahooReply(100)))(decodeURIComponent(String(params.symbol))),
    ),
  );
  if (world.groq) {
    const respond = world.groq;
    server.use(
      http.post('https://api.groq.com/openai/v1/chat/completions', async ({ request }) => {
        const body = (await request.json()) as { messages: Array<{ role: string; content: string }> };
        const kind: GroqKind = body.messages.some((m) => m.content.includes('4カテゴリのリスクを0-100で評価')) ? 'assess' : 'summarize';
        const prompt = body.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
        return respond(kind, prompt);
      }),
    );
  }
}

const summaryFor = (prompt: string, score: (index: number) => number = () => 70) => ({
  results: [...prompt.matchAll(/^\[(\d+)\]/gm)].map((m) => {
    const index = Number(m[1]);
    const s = score(index);
    return {
      index,
      summaryJa: `要約${index}`,
      relevanceScore: s,
      riskCategories: s >= 30 ? ['currency_finance'] : [],
    };
  }),
});

const assessmentFor = (scores: Partial<Record<RiskCategory, number>>) => ({
  assessments: Object.entries(scores).map(([category, score]) => ({
    category,
    score,
    summary: `${category} の概要`,
    factors: ['因子'],
    changeReasonJa: '変化なし',
  })),
});

const fullAssessment = (score = 50) => assessmentFor(Object.fromEntries(RISK_CATEGORIES.map((c) => [c, score])));

const llmWorld = (over: Partial<World> = {}): World => ({
  groq: (kind, prompt) => (kind === 'summarize' ? groqReply(summaryFor(prompt)) : groqReply(fullAssessment())),
  ...over,
});

function seed(name: string, data: unknown) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), typeof data === 'string' ? data : JSON.stringify(data));
}
const read = <T>(name: string): T => JSON.parse(readFileSync(join(dir, name), 'utf-8')) as T;
const files = () => readdirSync(dir).sort();
const run = (env: NodeJS.ProcessEnv = {}, now = NOW) => source.run({ dir, now, env });

function risk(category: RiskCategory, score: number): RiskAssessment {
  return { category, score, level: 'moderate', summaryJa: '前回', factorsJa: [], assessedAt: '2026-11-01T00:00:00.000Z' };
}
const prevRisks = RISK_CATEGORIES.map((c) => risk(c, 40));
const prevComposite: CompositeRisk = { compositeScore: 40, level: 'moderate', breakdown: [], delta: 2 };

function pendingArticle(id: string, over: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id,
    source: 'test',
    originalTitle: id,
    originalUrl: `https://e.com/${id}`,
    publishedAt: '2026-11-01T00:00:00.000Z',
    summaryJa: '',
    relevanceScore: 0,
    riskCategories: [],
    ...over,
  };
}

describe('source', () => {
  it('is registered as econ', () => {
    expect(source.id).toBe('econ');
  });
});

describe('run without an LLM key', () => {
  it('collects news, indicators and events, and writes nothing derived from the LLM', async () => {
    useWorld();
    const result = await run();

    expect(files()).toEqual(['events.json', 'indicators.json', 'news.json', 'seen-ids.json']);
    const news = NewsFileSchema.parse(read('news.json'));
    expect(news).toHaveLength(ECON_FEEDS.length);
    expect(news.every((a) => a.summaryJa === '')).toBe(true);
    expect(IndicatorsFileSchema.parse(read('indicators.json'))).toHaveLength(ASSETS.length);
    expect(EventsFileSchema.parse(read('events.json')).map((e) => e.date)).toEqual([
      '2026-11-10',
      '2026-11-16',
      '2026-12-04',
    ]);
    expect(read('seen-ids.json')).toEqual([]);
    expect(result).toEqual({
      counts: {
        feeds: ECON_FEEDS.length,
        failedFeeds: 0,
        articles: ECON_FEEDS.length,
        summariesAttempted: 0,
        summariesFailed: 0,
        indicators: ASSETS.length,
        unavailableIndicators: 0,
        risks: 0,
        events: 3,
      },
      errors: [LLM_DISABLED_ERROR],
      forceFailed: true,
    });
  });

  it('leaves risks, history and composite exactly as they were', async () => {
    useWorld();
    const history = { technology: [risk('technology', 55)] };
    seed('risks.json', prevRisks);
    seed('risk-history.json', history);
    seed('composite-risk.json', prevComposite);

    const result = await run();

    expect(read('risks.json')).toEqual(prevRisks);
    expect(read('risk-history.json')).toEqual(history);
    expect(read('composite-risk.json')).toEqual(prevComposite);
    expect(result.counts.risks).toBe(4);
    expect(result.errors).toEqual([LLM_DISABLED_ERROR]);
    expect(result.forceFailed).toBe(true);
  });

  it('treats an empty key as unset', async () => {
    useWorld();
    await expect(run({ GROQ_API_KEY: '', GEMINI_API_KEY: '' })).resolves.toMatchObject({ counts: { summariesAttempted: 0 } });
  });

  it('computes the composite once from carried-over risks when none exists yet', async () => {
    useWorld();
    seed('risks.json', prevRisks);
    await run();
    expect(CompositeRiskSchema.parse(read('composite-risk.json')).compositeScore).toBe(40);
  });

  it('does not invent a composite when there are no risks either', async () => {
    useWorld();
    await run();
    expect(files()).not.toContain('composite-risk.json');
  });

  it('keeps unsummarized articles from earlier runs and does not duplicate them', async () => {
    useWorld();
    await run();
    const first = read<NewsArticle[]>('news.json').map((a) => a.id).sort();
    await run();
    expect(read<NewsArticle[]>('news.json').map((a) => a.id).sort()).toEqual(first);
  });
});

describe('run with an LLM key', () => {
  it('summarizes the news, assesses the four risks and writes the composite and history', async () => {
    useWorld(llmWorld());
    const result = await run(KEYED);

    expect(files()).toEqual([
      'composite-risk.json',
      'events.json',
      'indicators.json',
      'news.json',
      'risk-history.json',
      'risks.json',
      'seen-ids.json',
    ]);
    const news = NewsFileSchema.parse(read('news.json'));
    expect(news.every((a) => a.summaryJa.startsWith('要約') && a.relevanceScore === 70)).toBe(true);

    const risks = RisksFileSchema.parse(read('risks.json'));
    expect(risks.map((r) => r.category)).toEqual([...RISK_CATEGORIES]);
    expect(risks.every((r) => r.assessedAt === NOW.toISOString())).toBe(true);
    const composite = CompositeRiskSchema.parse(read('composite-risk.json'));
    const weights = { currency_finance: 0.3, geopolitics_supply_chain: 0.3, technology: 0.2, social_policy: 0.2 };
    expect(composite.compositeScore).toBe(Math.round(risks.reduce((sum, r) => sum + r.score * weights[r.category], 0)));
    expect(composite.breakdown.map((b) => b.score)).toEqual(risks.map((r) => r.score));
    const history = RiskHistoryFileSchema.parse(read('risk-history.json'));
    expect(Object.keys(history).sort()).toEqual([...RISK_CATEGORIES].sort());

    expect(result.counts).toMatchObject({ summariesAttempted: 10, summariesFailed: 0, risks: 4, articles: 10 });
    expect(result.errors).toEqual([]);
  });

  it('blends the indicator signal into the currency_finance score', async () => {
    useWorld(llmWorld({ yahoo: (symbol) => yahooReply(symbol === '^VIX' ? 30 : 100) }));
    await run(KEYED);
    const risks = RisksFileSchema.parse(read('risks.json'));
    // VIX 30 → 50 and a non-inverted curve → 0, so the quant signal is their mean (25).
    expect(risks.find((r) => r.category === 'currency_finance')?.score).toBe(Math.round(0.7 * 50 + 0.3 * 25));
  });

  it('merges a partial LLM response over previous risks by category and keeps the composite faithful', async () => {
    useWorld(
      llmWorld({
        groq: (kind, prompt) =>
          kind === 'summarize' ? groqReply(summaryFor(prompt)) : groqReply(assessmentFor({ technology: 90 })),
      }),
    );
    seed('risks.json', prevRisks);
    seed('composite-risk.json', prevComposite);

    await run(KEYED);

    expect(read<RiskAssessment[]>('risks.json').map((r) => [r.category, r.score])).toEqual([
      ['currency_finance', 40],
      ['geopolitics_supply_chain', 40],
      ['technology', 90],
      ['social_policy', 40],
    ]);
    expect(read<CompositeRisk>('composite-risk.json')).toMatchObject({ compositeScore: 50, delta: 10 });
    expect(Object.keys(read('risk-history.json'))).toEqual(['technology']);
  });

  it('does not write a composite when the merged risks still miss a category, and says so', async () => {
    useWorld(
      llmWorld({
        groq: (kind, prompt) =>
          kind === 'summarize' ? groqReply(summaryFor(prompt)) : groqReply(assessmentFor({ technology: 90 })),
      }),
    );
    const result = await run(KEYED);
    expect(files()).not.toContain('composite-risk.json');
    expect(read<RiskAssessment[]>('risks.json')).toHaveLength(1);
    expect(result.errors).toEqual(['composite not updated: risk assessments do not cover every category']);
  });

  it('keeps previous risks, history and composite when the assessment fails, and reports it', async () => {
    useWorld(
      llmWorld({
        groq: (kind, prompt) =>
          kind === 'summarize' ? groqReply(summaryFor(prompt)) : HttpResponse.json({ error: { message: 'bad request' } }, { status: 400 }),
      }),
    );
    const history = { technology: [risk('technology', 55)] };
    seed('risks.json', prevRisks);
    seed('risk-history.json', history);
    seed('composite-risk.json', prevComposite);

    const result = await run(KEYED);

    expect(read('risks.json')).toEqual(prevRisks);
    expect(read('risk-history.json')).toEqual(history);
    expect(read('composite-risk.json')).toEqual(prevComposite);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^risk assessment failed: /);
    expect(NewsFileSchema.parse(read('news.json')).every((a) => a.summaryJa !== '')).toBe(true);
  });

  it('keeps articles pending, and spends no attempt, when every summary call fails', async () => {
    useWorld(
      llmWorld({
        groq: (kind) =>
          kind === 'summarize'
            ? HttpResponse.json({ error: { message: 'quota' } }, { status: 400 })
            : groqReply(fullAssessment()),
      }),
    );
    const result = await run(KEYED);

    const news = NewsFileSchema.parse(read('news.json'));
    expect(news).toHaveLength(ECON_FEEDS.length);
    expect(news.every((a) => a.summaryJa === '' && a.summaryAttempts === undefined)).toBe(true);
    expect(result.counts).toMatchObject({ summariesAttempted: 10, summariesFailed: 10 });
    expect(result.errors).toEqual(['10 of 10 summaries failed']);
  });

  it('publishes relevant news, drops the noise and remembers its ids', async () => {
    useWorld(
      llmWorld({
        groq: (kind, prompt) =>
          kind === 'summarize'
            ? groqReply(summaryFor(prompt, (i) => (i % 2 === 0 ? 70 : 5)))
            : groqReply(fullAssessment()),
      }),
    );
    seed('seen-ids.json', ['old']);

    const keyed = await run(KEYED);
    expect(keyed.forceFailed).toBe(false);
    expect(keyed.errors).not.toContain(LLM_DISABLED_ERROR);

    const news = NewsFileSchema.parse(read('news.json'));
    expect(news).toHaveLength(5);
    expect(news.every((a) => a.relevanceScore === 70)).toBe(true);
    const seen = read<string[]>('seen-ids.json');
    expect(seen[0]).toBe('old');
    expect(seen).toHaveLength(6);
    expect(news.some((a) => seen.includes(a.id))).toBe(false);
  });

  it('retries summaries for articles carried over from earlier runs', async () => {
    const seenPrompts: string[] = [];
    useWorld(
      llmWorld({
        feed: () => xml(rss('', '')),
        groq: (kind, prompt) => {
          if (kind === 'summarize') seenPrompts.push(prompt);
          return kind === 'summarize' ? groqReply(summaryFor(prompt)) : groqReply(fullAssessment());
        },
      }),
    );
    seed('news.json', [pendingArticle('a', { summaryAttempts: 2 }), pendingArticle('b', { summaryAttempts: 3 })]);

    await run(KEYED);

    expect(seenPrompts).toEqual(['[0] test: a']);
    const news = read<NewsArticle[]>('news.json');
    expect(news.map((a) => [a.id, a.summaryJa !== ''])).toEqual([['a', true]]);
    expect(read<string[]>('seen-ids.json')).toEqual(['b']);
  });
});

describe('run health', () => {
  it('reports feeds that failed and counts them', async () => {
    useWorld(llmWorld({ feed: (s) => (s === 'ft' || s === 'wsj' ? new HttpResponse('', { status: 404 }) : xml(rss(`${s} headline`, `https://e.com/${s}`))) }));
    const result = await run(KEYED);
    expect(result.errors).toEqual(['RSS failed: wsj (HTTP 404)', 'RSS failed: ft (HTTP 404)']);
    expect(result.counts).toMatchObject({ feeds: ECON_FEEDS.length, failedFeeds: 2, articles: ECON_FEEDS.length - 2 });
  });

  it('throws before writing anything when every feed fails', async () => {
    useWorld({ feed: () => new HttpResponse('', { status: 404 }) });
    await expect(run()).rejects.toThrow(`All ${ECON_FEEDS.length} RSS sources failed`);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('carries cached indicators forward as stale and names the ones it could not refresh', async () => {
    useWorld(llmWorld({ yahoo: (symbol) => (symbol === '^VIX' ? new HttpResponse('', { status: 500 }) : yahooReply(100)) }));
    seed('indicators.json', [
      { code: 'VIX', name: '恐怖指数(VIX)', value: 22, previousValue: 21, unit: 'pt', source: 'yahoo', recordedAt: '2026-11-01T00:00:00.000Z' },
    ]);
    const result = await run(KEYED);
    const vix = IndicatorsFileSchema.parse(read('indicators.json')).find((i) => i.code === 'VIX');
    expect(vix).toMatchObject({ value: 22, stale: true, recordedAt: '2026-11-01T00:00:00.000Z' });
    expect(result.errors).toEqual(['indicators unavailable or stale: VIX (HTTP 500)']);
    expect(result.counts).toMatchObject({ indicators: ASSETS.length, unavailableIndicators: 1 });
  });

  it('warns when the event definitions are about to run out', async () => {
    useWorld(llmWorld());
    const result = await run(KEYED, new Date('2028-01-01T00:00:00.000Z'));
    expect(result.errors).toEqual([expect.stringContaining('ECONOMIC_EVENTS has no events after')]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[events]'));
    expect(read('events.json')).toEqual([]);
  });

  it('does not warn about event coverage while the definitions are far enough ahead', async () => {
    useWorld(llmWorld());
    expect((await run(KEYED)).errors).toEqual([]);
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('[events]'));
  });
});

describe('run with unreadable input', () => {
  it('lets a corrupt history abort the run before anything is written', async () => {
    useWorld();
    seed('risk-history.json', '{not json');
    await expect(run()).rejects.toThrow('not valid JSON');
    expect(files()).toEqual(['risk-history.json']);
  });

  it('lets a file of the wrong shape abort the run before anything is written', async () => {
    useWorld();
    seed('risks.json', [{ category: 'mystery', score: 1 }]);
    await expect(run()).rejects.toThrow('unexpected shape');
    expect(files()).toEqual(['risks.json']);
  });
});

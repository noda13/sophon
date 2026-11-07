import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCollection } from './pipeline.js';
import { readJson, writeJsonBatch } from './io.js';
import { detectProvider } from './llm.js';
import { collectNews, RSS_SOURCES } from './news.js';
import { collectIndicators } from './indicators.js';
import { summarize } from './summarize.js';
import { assess } from './assess.js';
import type { CompositeRisk, NewsArticle, RiskAssessment } from './types.js';

vi.mock('./io.js', () => ({ readJson: vi.fn(), writeJsonBatch: vi.fn() }));
vi.mock('./llm.js', () => ({ detectProvider: vi.fn() }));
vi.mock('./news.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./news.js')>()),
  collectNews: vi.fn(),
}));
vi.mock('./indicators.js', () => ({ collectIndicators: vi.fn() }));
vi.mock('./summarize.js', () => ({ summarize: vi.fn() }));
vi.mock('./assess.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./assess.js')>()),
  assess: vi.fn(),
}));

const NOW = new Date('2026-11-07T12:00:00.000Z');
const CATEGORIES = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];

function risk(category: string, score: number, assessedAt = '2026-11-01T00:00:00.000Z'): RiskAssessment {
  return { category, score, level: 'low', summaryJa: '', factorsJa: [], assessedAt };
}

function news(id: string, over: Partial<NewsArticle> = {}): NewsArticle {
  return {
    id, source: 'test', originalTitle: id, originalUrl: `https://e.com/${id}`,
    publishedAt: '2026-11-01T00:00:00.000Z', summaryJa: '', relevanceScore: 0, riskCategories: [], ...over,
  };
}

let store: Record<string, unknown>;

function written(): Record<string, any> {
  const calls = vi.mocked(writeJsonBatch).mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0][0] as Record<string, any>;
}

describe('runCollection', () => {
  beforeEach(() => {
    store = {};
    vi.mocked(readJson).mockImplementation(((name: string, fallback: unknown) => (name in store ? store[name] : fallback)) as typeof readJson);
    vi.mocked(writeJsonBatch).mockReset();
    vi.mocked(detectProvider).mockReset().mockReturnValue(null);
    vi.mocked(collectNews).mockReset().mockResolvedValue([]);
    vi.mocked(collectIndicators).mockReset().mockResolvedValue([]);
    vi.mocked(summarize).mockReset().mockResolvedValue({ attempted: 0, failed: 0 });
    vi.mocked(assess).mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const llm = { provider: 'groq', baseUrl: '', model: '', key: 'k' };
  const prevRisks = CATEGORIES.map(c => risk(c, 40));
  const prevComposite: CompositeRisk = { compositeScore: 40, level: 'moderate', breakdown: [], delta: 2 };

  it('merges a partial LLM response over previous risks by category and keeps the composite faithful', async () => {
    store = { 'risks.json': prevRisks, 'composite-risk.json': prevComposite };
    vi.mocked(detectProvider).mockReturnValue(llm);
    vi.mocked(assess).mockResolvedValue([risk('technology', 90, NOW.toISOString())]);

    await runCollection(NOW);

    const out = written();
    expect(out['risks.json'].map((r: RiskAssessment) => [r.category, r.score])).toEqual([
      ['currency_finance', 40], ['geopolitics_supply_chain', 40], ['technology', 90], ['social_policy', 40],
    ]);
    expect(out['composite-risk.json'].compositeScore).toBe(50);
    expect(out['composite-risk.json'].delta).toBe(10);
    expect(Object.keys(out['risk-history.json'])).toEqual(['technology']);
    expect(out['meta.json'].lastUpdated).toBe(NOW.toISOString());
  });

  it('does not write composite when the merged risks still miss a category', async () => {
    vi.mocked(detectProvider).mockReturnValue(llm);
    vi.mocked(assess).mockResolvedValue([risk('technology', 90, NOW.toISOString())]);

    await runCollection(NOW);

    const out = written();
    expect(out).not.toHaveProperty('composite-risk.json');
    expect(out['risks.json']).toHaveLength(1);
  });

  it('leaves risks, history, composite and lastUpdated untouched when no LLM key is set', async () => {
    store = { 'risks.json': prevRisks, 'composite-risk.json': prevComposite, 'meta.json': { lastUpdated: '2026-08-04T00:00:00.000Z' } };

    await runCollection(NOW);

    const out = written();
    for (const f of ['risks.json', 'risk-history.json', 'composite-risk.json']) expect(out).not.toHaveProperty(f);
    expect(out['meta.json']).toEqual({
      lastUpdated: '2026-08-04T00:00:00.000Z',
      lastCollectedAt: NOW.toISOString(),
      lastRun: {
        sources: { total: RSS_SOURCES.length, failed: [] },
        summaries: { attempted: 0, failed: 0 },
        assessment: 'skipped',
      },
    });
    expect(summarize).not.toHaveBeenCalled();
  });

  it('behaves the same when the assessment throws', async () => {
    store = { 'risks.json': prevRisks, 'composite-risk.json': prevComposite };
    vi.mocked(detectProvider).mockReturnValue(llm);
    vi.mocked(assess).mockRejectedValue(new Error('bad json'));

    await runCollection(NOW);

    const out = written();
    for (const f of ['risks.json', 'risk-history.json', 'composite-risk.json']) expect(out).not.toHaveProperty(f);
    expect(out['meta.json']).not.toHaveProperty('lastUpdated');
  });

  it('records failed sources, summary counts and a successful assessment in lastRun', async () => {
    vi.mocked(detectProvider).mockReturnValue(llm);
    vi.mocked(collectNews).mockImplementation(async (_e, _s, failed) => { failed?.push('ft', 'wsj'); return []; });
    vi.mocked(summarize).mockResolvedValue({ attempted: 10, failed: 4 });
    vi.mocked(assess).mockResolvedValue(CATEGORIES.map(c => risk(c, 50, NOW.toISOString())));

    await runCollection(NOW);

    expect(written()['meta.json'].lastRun).toEqual({
      sources: { total: RSS_SOURCES.length, failed: ['ft', 'wsj'] },
      summaries: { attempted: 10, failed: 4 },
      assessment: 'ok',
    });
  });

  it('records assessment as failed in lastRun when the assessment throws', async () => {
    vi.mocked(detectProvider).mockReturnValue(llm);
    vi.mocked(assess).mockRejectedValue(new Error('bad json'));

    await runCollection(NOW);

    expect(written()['meta.json'].lastRun.assessment).toBe('failed');
  });

  it('computes the composite once when none exists yet', async () => {
    store = { 'risks.json': prevRisks };
    await runCollection(NOW);
    expect(written()['composite-risk.json'].compositeScore).toBe(40);
  });

  it('publishes relevant news, keeps pending ones and remembers dropped ids', async () => {
    store = { 'seen-ids.json': ['old'] };
    vi.mocked(collectNews).mockResolvedValue([
      news('pending'),
      news('keep', { summaryJa: 's', relevanceScore: 60 }),
      news('noise', { summaryJa: 's', relevanceScore: 5 }),
    ]);

    await runCollection(NOW);

    const out = written();
    expect(out['news.json'].map((a: NewsArticle) => a.id)).toEqual(['pending', 'keep']);
    expect(out['seen-ids.json']).toEqual(['old', 'noise']);
    expect(collectNews).toHaveBeenCalledWith([], ['old'], expect.any(Array));
  });

  it('warns when the event definitions are about to run out', async () => {
    await runCollection(new Date('2028-01-01T00:00:00.000Z'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[economic-events]'));
  });

  it('does not warn about event coverage while the definitions are far enough ahead', async () => {
    await runCollection(NOW);
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('[economic-events]'));
  });

  it('lets a corrupt input file abort the run before anything is written', async () => {
    vi.mocked(readJson).mockImplementation(() => { throw new Error('risk-history.json is not valid JSON'); });
    await expect(runCollection(NOW)).rejects.toThrow('not valid JSON');
    expect(writeJsonBatch).not.toHaveBeenCalled();
  });

  it('always writes indicators and events', async () => {
    await runCollection(NOW);
    const out = written();
    expect(out).toHaveProperty('indicators.json');
    expect(Array.isArray(out['events.json'])).toBe(true);
  });
});

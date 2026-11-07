import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assess, computeQuantSignal, mergeRisks } from './assess.js';
import { callLLM } from './llm.js';
import type { EconomicIndicator, NewsArticle, RiskAssessment } from './types.js';

vi.mock('./llm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./llm.js')>()),
  callLLM: vi.fn(),
}));

function ind(code: string, value: number, previousValue: number | null = null): EconomicIndicator {
  return { code, name: code, value, previousValue, unit: '', source: 'test', recordedAt: '2026-10-24T00:00:00.000Z' };
}

describe('computeQuantSignal: currency_finance', () => {
  it('uses VIX alone as round(vix / 60 * 100)', () => {
    expect(computeQuantSignal('currency_finance', [ind('VIX', 30)])).toBe(50);
    expect(computeQuantSignal('currency_finance', [ind('VIX', 20)])).toBe(33);
    expect(computeQuantSignal('currency_finance', [ind('VIX', 21)])).toBe(35);
    expect(computeQuantSignal('currency_finance', [ind('VIX', 60)])).toBe(100);
  });

  it('caps the VIX signal at 100', () => {
    expect(computeQuantSignal('currency_finance', [ind('VIX', 61)])).toBe(100);
    expect(computeQuantSignal('currency_finance', [ind('VIX', 90)])).toBe(100);
  });

  it('treats a VIX of 0 as a present indicator with signal 0, not as missing', () => {
    expect(computeQuantSignal('currency_finance', [ind('VIX', 0)])).toBe(0);
  });

  it('scores an inverted curve (UST10Y < UST3M) as round(abs(spread) / 3 * 100)', () => {
    const curve = (t10y: number, t3m: number) => [ind('UST10Y', t10y), ind('UST3M', t3m)];
    expect(computeQuantSignal('currency_finance', curve(4.5, 5))).toBe(17);
    expect(computeQuantSignal('currency_finance', curve(3, 5))).toBe(67);
    expect(computeQuantSignal('currency_finance', curve(2, 5))).toBe(100);
  });

  it('caps the yield-curve signal at 100 for spreads below -3', () => {
    expect(computeQuantSignal('currency_finance', [ind('UST10Y', 1), ind('UST3M', 5)])).toBe(100);
  });

  it('scores a non-inverted curve as 0 and still counts it as a component', () => {
    expect(computeQuantSignal('currency_finance', [ind('UST10Y', 4), ind('UST3M', 3)])).toBe(0);
  });

  it('scores a flat curve (spread exactly 0) as 0', () => {
    expect(computeQuantSignal('currency_finance', [ind('UST10Y', 4), ind('UST3M', 4)])).toBe(0);
  });

  it('ignores a lone UST10Y or UST3M because the spread needs both', () => {
    expect(computeQuantSignal('currency_finance', [ind('UST10Y', 3)])).toBeNull();
    expect(computeQuantSignal('currency_finance', [ind('UST3M', 5)])).toBeNull();
    expect(computeQuantSignal('currency_finance', [ind('VIX', 30), ind('UST3M', 5)])).toBe(50);
  });

  it('averages VIX and an inverted curve', () => {
    const indicators = [ind('VIX', 30), ind('UST10Y', 3), ind('UST3M', 5)];
    expect(computeQuantSignal('currency_finance', indicators)).toBe(59);
  });

  it('averages VIX with a non-inverted curve at zero rather than dropping the curve', () => {
    const indicators = [ind('VIX', 30), ind('UST10Y', 4), ind('UST3M', 3)];
    expect(computeQuantSignal('currency_finance', indicators)).toBe(25);
  });

  it('returns null when neither VIX nor a full curve is available', () => {
    expect(computeQuantSignal('currency_finance', [])).toBeNull();
    expect(computeQuantSignal('currency_finance', [ind('WTI', 80, 70), ind('GOLD', 2000, 1900)])).toBeNull();
  });
});

describe('computeQuantSignal: geopolitics_supply_chain', () => {
  it('scores WTI as round(abs(change %) / 10 * 100)', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 103, 100)])).toBe(30);
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 109, 100)])).toBe(90);
  });

  it('treats price drops the same as price rises', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 97, 100)])).toBe(30);
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('GOLD', 90, 100)])).toBe(100);
  });

  it('reaches 100 at exactly a 10% move', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('GOLD', 110, 100)])).toBe(100);
  });

  it('caps the signal at 100 for moves above 10%', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 150, 100)])).toBe(100);
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 10, 100)])).toBe(100);
  });

  it('averages WTI and GOLD', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 103, 100), ind('GOLD', 110, 100)])).toBe(65);
  });

  it('contributes 0 but still counts the indicator when previousValue is null', () => {
    const indicators = [ind('WTI', 80, null), ind('GOLD', 105, 100)];
    expect(computeQuantSignal('geopolitics_supply_chain', indicators)).toBe(25);
  });

  it('contributes 0 but still counts the indicator when previousValue is 0', () => {
    const indicators = [ind('WTI', 80, 0), ind('GOLD', 105, 100)];
    expect(computeQuantSignal('geopolitics_supply_chain', indicators)).toBe(25);
  });

  it('returns 0 rather than null for a single indicator without a previous value', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 80, null)])).toBe(0);
  });

  it('uses a single available indicator on its own', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('GOLD', 105, 100)])).toBe(50);
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 105, 100)])).toBe(50);
  });

  it('returns null when neither WTI nor GOLD is available', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [])).toBeNull();
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('VIX', 40, 20)])).toBeNull();
  });
});

describe('computeQuantSignal: stale indicators', () => {
  it('ignores indicators flagged stale', () => {
    expect(computeQuantSignal('currency_finance', [{ ...ind('VIX', 60), stale: true }])).toBeNull();
    expect(computeQuantSignal('currency_finance', [{ ...ind('VIX', 60), stale: true }, ind('UST10Y', 3), ind('UST3M', 5)])).toBe(67);
  });
});

describe('computeQuantSignal: other categories', () => {
  const all = [
    ind('VIX', 40, 20),
    ind('UST10Y', 3, 4),
    ind('UST3M', 5, 5),
    ind('WTI', 120, 100),
    ind('GOLD', 2200, 2000),
  ];

  it.each(['technology', 'social_policy', 'unknown', ''])('returns null for %j even with full data', (category) => {
    expect(computeQuantSignal(category, all)).toBeNull();
  });

  it('does not let geopolitics indicators leak into currency_finance', () => {
    expect(computeQuantSignal('currency_finance', [ind('VIX', 30), ind('WTI', 150, 100)])).toBe(50);
  });

  it('does not let currency indicators leak into geopolitics_supply_chain', () => {
    expect(computeQuantSignal('geopolitics_supply_chain', [ind('WTI', 105, 100), ind('VIX', 90)])).toBe(50);
  });
});

describe('assess', () => {
  const callLLMMock = vi.mocked(callLLM);

  function news(id: string): NewsArticle {
    return {
      id,
      source: 'test',
      originalTitle: `title ${id}`,
      originalUrl: `https://example.com/${id}`,
      publishedAt: '2026-10-24T00:00:00.000Z',
      summaryJa: `summary ${id}`,
      relevanceScore: 50,
      riskCategories: [],
    };
  }

  function llmEntry(category: string, score: number, extra: Record<string, unknown> = {}) {
    return { category, score, summary: `${category} summary`, factors: ['f1'], ...extra };
  }

  function respondWith(assessments: unknown[]) {
    callLLMMock.mockResolvedValue(JSON.stringify({ assessments }));
  }

  beforeEach(() => {
    callLLMMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blends the LLM score (0.7) with the quantitative signal (0.3)', async () => {
    respondWith([llmEntry('currency_finance', 80)]);
    const [result] = await assess([], [ind('VIX', 30)], []);
    expect(result.score).toBe(71);
    expect(result.level).toBe('high');
  });

  it('uses the LLM score unchanged when no quantitative signal exists', async () => {
    respondWith([llmEntry('technology', 80), llmEntry('currency_finance', 64)]);
    const results = await assess([], [], []);
    expect(results.map(r => [r.category, r.score])).toEqual([
      ['technology', 80],
      ['currency_finance', 64],
    ]);
  });

  it('derives the level from the blended score', async () => {
    respondWith([llmEntry('technology', 20), llmEntry('social_policy', 21)]);
    const results = await assess([], [], []);
    expect(results.map(r => r.level)).toEqual(['low', 'moderate']);
  });

  it('sets delta from the previous score of the same category and omits it when there is none', async () => {
    respondWith([llmEntry('technology', 50), llmEntry('social_policy', 30)]);
    const prev: RiskAssessment[] = [
      { category: 'technology', score: 60, level: 'elevated', summaryJa: '', factorsJa: [], assessedAt: '' },
    ];
    const [tech, social] = await assess([], [], prev);
    expect(tech.delta).toBe(-10);
    expect(social).not.toHaveProperty('delta');
  });

  it('keeps delta 0 when the score is unchanged', async () => {
    respondWith([llmEntry('technology', 50)]);
    const prev: RiskAssessment[] = [
      { category: 'technology', score: 50, level: 'elevated', summaryJa: '', factorsJa: [], assessedAt: '' },
    ];
    const [tech] = await assess([], [], prev);
    expect(tech.delta).toBe(0);
  });

  it('keeps only source news ids that exist and limits them to 3', async () => {
    respondWith([
      llmEntry('technology', 50, { sourceNewsIds: ['a', 'ghost', 'b', 'c', 'd'] }),
      llmEntry('social_policy', 50, { sourceNewsIds: ['ghost'] }),
    ]);
    const [tech, social] = await assess([news('a'), news('b'), news('c'), news('d')], [], []);
    expect(tech.sourceNewsIds).toEqual(['a', 'b', 'c']);
    expect(social).not.toHaveProperty('sourceNewsIds');
  });

  it('drops entries that fail validation and keeps the valid ones', async () => {
    respondWith([
      llmEntry('technology', 101),
      llmEntry('technology', 50.5),
      llmEntry('mystery', 50),
      llmEntry('social_policy', 40),
    ]);
    const results = await assess([], [], []);
    expect(results.map(r => r.category)).toEqual(['social_policy']);
  });

  it('keeps only the first entry when the LLM repeats a category', async () => {
    respondWith([llmEntry('technology', 40), llmEntry('technology', 90), llmEntry('social_policy', 10)]);
    const results = await assess([], [], []);
    expect(results.map(r => [r.category, r.score])).toEqual([['technology', 40], ['social_policy', 10]]);
  });

  it('accepts the score bounds 0 and 100', async () => {
    respondWith([llmEntry('technology', 0), llmEntry('social_policy', 100)]);
    const results = await assess([], [], []);
    expect(results.map(r => r.score)).toEqual([0, 100]);
  });

  it('throws when no entry is valid', async () => {
    respondWith([llmEntry('mystery', 50)]);
    await expect(assess([], [], [])).rejects.toThrow('LLM assessment returned no valid entries');
  });

  it('throws when the LLM response has no assessments array', async () => {
    callLLMMock.mockResolvedValue(JSON.stringify({ result: [] }));
    await expect(assess([], [], [])).rejects.toThrow();
  });

  it('passes the numbered news, indicators and previous scores to the LLM', async () => {
    respondWith([llmEntry('technology', 50)]);
    const prev: RiskAssessment[] = [
      { category: 'technology', score: 60, level: 'elevated', summaryJa: '', factorsJa: [], assessedAt: '' },
    ];
    await assess([news('n1')], [ind('VIX', 30, 25)], prev);
    const [, userMessage] = callLLMMock.mock.calls[0];
    expect(userMessage).toContain('[id:n1] [test] summary n1');
    expect(userMessage).toContain('- VIX: 30 (前回:25)');
    expect(userMessage).toContain('- technology: 60');
  });

  it('sends only the 20 most recent news items that have a summary', async () => {
    respondWith([llmEntry('technology', 50)]);
    const articles = Array.from({ length: 25 }, (_, i) => news(`n${i}`));
    articles.unshift({ ...news('unsummarized'), summaryJa: '' });
    await assess(articles, [], []);
    const [, userMessage] = callLLMMock.mock.calls[0];
    expect(userMessage).not.toContain('unsummarized');
    expect(userMessage).toContain('[id:n19]');
    expect(userMessage).not.toContain('[id:n20]');
  });
});

describe('mergeRisks', () => {
  const entry = (category: string, score: number): RiskAssessment => ({
    category, score, level: 'low', summaryJa: '', factorsJa: [], assessedAt: '2026-10-24T00:00:00.000Z',
  });

  it('carries forward previous entries for categories missing from the fresh result', () => {
    const prev = [entry('currency_finance', 10), entry('technology', 20), entry('social_policy', 30)];
    const merged = mergeRisks(prev, [entry('technology', 99)]);
    expect(merged.map(r => [r.category, r.score])).toEqual([
      ['currency_finance', 10],
      ['technology', 99],
      ['social_policy', 30],
    ]);
  });

  it('drops unknown categories and leaves categories with no data out', () => {
    const merged = mergeRisks([entry('mystery', 1)], [entry('technology', 5)]);
    expect(merged.map(r => r.category)).toEqual(['technology']);
  });
});

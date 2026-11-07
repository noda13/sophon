import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn((args: unknown) => args),
  transaction: vi.fn(async () => []),
  callLLM: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    newsArticle: { findMany: vi.fn(async () => []) },
    economicIndicator: { findFirst: vi.fn(async () => null) },
    riskAssessment: { findFirst: vi.fn(async () => null), create: mocks.create },
    $transaction: mocks.transaction,
  },
}));
vi.mock('./llm.js', async () => {
  const actual = await vi.importActual<typeof import('./llm.js')>('./llm.js');
  return { ...actual, callLLM: mocks.callLLM, isConfigured: () => true };
});
vi.mock('./indicatorCollector.js', () => ({ INDICATOR_CODES: ['VIX'] }));
vi.mock('../lib/config.js', () => ({
  config: { geminiApiKey: '', geminiModel: 'm', ollamaBaseUrl: '', ollamaModel: 'm' },
}));

import { assessRisks } from './riskAssessor.js';

const usage = { inputTokens: 1, outputTokens: 1 };
const CATEGORIES = ['currency_finance', 'geopolitics_supply_chain', 'technology', 'social_policy'];

const assessment = (category: string, score = 50) => ({
  category,
  score,
  summary: '概要',
  factors: ['a', 'b'],
});

const reply = (assessments: unknown[]) => ({ text: JSON.stringify({ assessments }), usage });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('assessRisks', () => {
  it('stores one row per category with a rounded score and derived level', async () => {
    mocks.callLLM.mockResolvedValue(reply(CATEGORIES.map((c, i) => assessment(c, i === 0 ? 70.4 : 10))));

    expect(await assessRisks()).toEqual({ assessed: true });

    const rows = mocks.create.mock.calls.map((c) => (c[0] as { data: { category: string; score: number; level: string } }).data);
    expect(rows.map((r) => r.category)).toEqual(CATEGORIES);
    expect(rows[0]).toMatchObject({ score: 70, level: 'high' });
    expect(rows[1]).toMatchObject({ score: 10, level: 'low' });
  });

  it('accepts JSON wrapped in prose', async () => {
    const body = JSON.stringify({ assessments: CATEGORIES.map((c) => assessment(c)) });
    mocks.callLLM.mockResolvedValue({ text: `Here you go:\n${body}\nThanks`, usage });

    expect(await assessRisks()).toEqual({ assessed: true });
  });

  it('writes nothing when a category is missing', async () => {
    mocks.callLLM.mockResolvedValue(reply(CATEGORIES.slice(0, 3).map((c) => assessment(c))));

    expect(await assessRisks()).toEqual({ assessed: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('writes nothing when a category is duplicated', async () => {
    mocks.callLLM.mockResolvedValue(
      reply([...CATEGORIES.slice(0, 3), CATEGORIES[0]].map((c) => assessment(c))),
    );

    expect(await assessRisks()).toEqual({ assessed: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('writes nothing when a score is out of range or the category is unknown', async () => {
    mocks.callLLM.mockResolvedValue(reply(CATEGORIES.map((c, i) => assessment(c, i === 0 ? 120 : 50))));
    expect(await assessRisks()).toEqual({ assessed: false });

    mocks.callLLM.mockResolvedValue(reply([...CATEGORIES.slice(0, 3), 'economy'].map((c) => assessment(c))));
    expect(await assessRisks()).toEqual({ assessed: false });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns assessed:false when the response is not JSON', async () => {
    mocks.callLLM.mockResolvedValue({ text: 'no json here', usage });

    expect(await assessRisks()).toEqual({ assessed: false });
  });
});

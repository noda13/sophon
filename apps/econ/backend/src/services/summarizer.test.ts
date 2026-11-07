import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(async (_args: unknown) => ({})),
  callLLM: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: { newsArticle: { findMany: mocks.findMany, update: mocks.update } },
}));
vi.mock('./llm.js', async () => {
  const actual = await vi.importActual<typeof import('./llm.js')>('./llm.js');
  return { ...actual, callLLM: mocks.callLLM, isConfigured: () => true };
});
vi.mock('../lib/config.js', () => ({
  config: { geminiApiKey: '', geminiModel: 'm', ollamaBaseUrl: '', ollamaModel: 'm' },
}));

import { summarizeUnsummarized } from './summarizer.js';

const usage = { inputTokens: 1, outputTokens: 1 };
const llmReply = (value: unknown) => ({ text: JSON.stringify(value), usage });

function articles(n: number, rawContent: string | null = null) {
  return Array.from({ length: n }, (_, i) => ({
    id: 100 + i,
    originalTitle: `title ${i}`,
    source: 'cnbc',
    rawContent,
  }));
}

const item = (index: number, overrides: Record<string, unknown> = {}) => ({
  index,
  summaryJa: `要約${index}`,
  relevanceScore: 80,
  riskCategories: ['currency_finance'],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('summarizeUnsummarized', () => {
  it('writes the valid items even when another item in the batch is invalid', async () => {
    mocks.findMany.mockResolvedValue(articles(3));
    mocks.callLLM.mockResolvedValue(
      llmReply({ articles: [item(0), item(1, { riskCategories: ['economy'] }), item(2)] }),
    );

    const result = await summarizeUnsummarized();

    expect(result).toEqual({ summarized: 2, failedBatches: 1, pending: 1 });
    const updatedIds = mocks.update.mock.calls.map((c) => (c[0] as { where: { id: number } }).where.id);
    expect(updatedIds).toEqual([100, 102]);
  });

  it('rejects empty and whitespace-only summaries', async () => {
    mocks.findMany.mockResolvedValue(articles(2));
    mocks.callLLM.mockResolvedValue(
      llmReply({ articles: [item(0, { summaryJa: '' }), item(1, { summaryJa: '   ' })] }),
    );

    const result = await summarizeUnsummarized();

    expect(mocks.update).not.toHaveBeenCalled();
    expect(result).toEqual({ summarized: 0, failedBatches: 1, pending: 2 });
  });

  it('accepts a bare array as well as the wrapped object', async () => {
    mocks.findMany.mockResolvedValue(articles(1));
    mocks.callLLM.mockResolvedValue(llmReply([item(0)]));

    expect((await summarizeUnsummarized()).summarized).toBe(1);
  });

  it('clamps and rounds the relevance score into 0-100', async () => {
    mocks.findMany.mockResolvedValue(articles(3));
    mocks.callLLM.mockResolvedValue(
      llmReply({ articles: [item(0, { relevanceScore: 150 }), item(1, { relevanceScore: -4 }), item(2, { relevanceScore: 55.6 })] }),
    );

    await summarizeUnsummarized();

    const scores = mocks.update.mock.calls.map((c) => (c[0] as { data: { relevanceScore: number } }).data.relevanceScore);
    expect(scores).toEqual([100, 0, 56]);
  });

  it('ignores out-of-range and duplicate indexes', async () => {
    mocks.findMany.mockResolvedValue(articles(2));
    mocks.callLLM.mockResolvedValue(llmReply({ articles: [item(0), item(0), item(9)] }));

    const result = await summarizeUnsummarized();

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(result.summarized).toBe(1);
  });

  it('counts a batch as failed when the response is not JSON', async () => {
    mocks.findMany.mockResolvedValue(articles(2));
    mocks.callLLM.mockResolvedValue({ text: 'sorry, I cannot', usage });

    expect(await summarizeUnsummarized()).toEqual({ summarized: 0, failedBatches: 1, pending: 2 });
  });

  it('counts a batch as failed when the LLM call throws', async () => {
    mocks.findMany.mockResolvedValue(articles(2));
    mocks.callLLM.mockRejectedValue(new Error('timeout'));

    expect(await summarizeUnsummarized()).toEqual({ summarized: 0, failedBatches: 1, pending: 2 });
  });

  it('sends the article body to the LLM when available', async () => {
    mocks.findMany.mockResolvedValue(articles(1, 'Fed holds rates steady'));
    mocks.callLLM.mockResolvedValue(llmReply({ articles: [item(0)] }));

    await summarizeUnsummarized();

    const userMessage = mocks.callLLM.mock.calls[0][1] as string;
    expect(userMessage).toContain('Title: title 0');
    expect(userMessage).toContain('Content: Fed holds rates steady');
  });
});

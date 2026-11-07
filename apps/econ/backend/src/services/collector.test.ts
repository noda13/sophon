import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logCreate: vi.fn(async () => ({ id: 1 })),
  logUpdate: vi.fn(async () => ({})),
  collectNews: vi.fn(),
  collectIndicators: vi.fn(),
  summarizeUnsummarized: vi.fn(),
  assessRisks: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: { collectionLog: { create: mocks.logCreate, update: mocks.logUpdate, updateMany: vi.fn() } },
}));
vi.mock('./newsCollector.js', () => ({ collectNews: mocks.collectNews }));
vi.mock('./indicatorCollector.js', () => ({ collectIndicators: mocks.collectIndicators }));
vi.mock('./summarizer.js', () => ({ summarizeUnsummarized: mocks.summarizeUnsummarized }));
vi.mock('./riskAssessor.js', () => ({ assessRisks: mocks.assessRisks }));
vi.mock('./llm.js', () => ({
  getSessionTokenUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
  resetSessionTokenUsage: vi.fn(),
  ensureProviderReady: vi.fn(async () => {}),
}));

import { CollectionInProgressError, isCollectionRunning, runCollection } from './collector.js';

const healthy = {
  news: { collected: 3, skipped: 0, feedsFailed: 0, feedsTotal: 10 },
  indicators: { collected: 7, failed: 0 },
  summary: { summarized: 3, failedBatches: 0, pending: 0 },
  risk: { assessed: true },
};

function setupHealthy() {
  mocks.collectNews.mockResolvedValue(healthy.news);
  mocks.collectIndicators.mockResolvedValue(healthy.indicators);
  mocks.summarizeUnsummarized.mockResolvedValue(healthy.summary);
  mocks.assessRisks.mockResolvedValue(healthy.risk);
}

function lastStatus(): string {
  const calls = mocks.logUpdate.mock.calls as unknown as Array<[{ data: { status: string } }]>;
  return calls[calls.length - 1][0].data.status;
}

function lastMessage(): string {
  const calls = mocks.logUpdate.mock.calls as unknown as Array<[{ data: { message: string } }]>;
  return calls[calls.length - 1][0].data.message;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setupHealthy();
});

describe('runCollection lock', () => {
  it('rejects a concurrent run and releases the lock afterwards', async () => {
    let release!: () => void;
    mocks.collectNews.mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve(healthy.news); }),
    );

    const first = runCollection();
    await vi.waitFor(() => expect(isCollectionRunning()).toBe(true));
    await expect(runCollection()).rejects.toBeInstanceOf(CollectionInProgressError);

    release();
    await first;
    expect(isCollectionRunning()).toBe(false);
    await expect(runCollection()).resolves.toBeDefined();
  });

  it('releases the lock and records an error when collection throws', async () => {
    mocks.collectIndicators.mockRejectedValueOnce(new Error('boom'));

    await expect(runCollection()).rejects.toThrow('boom');
    expect(isCollectionRunning()).toBe(false);
    expect(lastStatus()).toBe('error');
  });
});

describe('collection status', () => {
  it('is success when every step produced results', async () => {
    await runCollection();
    expect(lastStatus()).toBe('success');
  });

  it('is partial when news sources failed', async () => {
    mocks.collectNews.mockResolvedValue({ collected: 0, skipped: 0, feedsFailed: 10, feedsTotal: 10 });
    await runCollection();
    expect(lastStatus()).toBe('partial');
    expect(lastMessage()).toContain('news sources failed: 10/10');
  });

  it('is partial when summarization batches failed', async () => {
    mocks.summarizeUnsummarized.mockResolvedValue({ summarized: 0, failedBatches: 5, pending: 50 });
    await runCollection();
    expect(lastStatus()).toBe('partial');
    expect(lastMessage()).toContain('50 article(s) pending');
  });

  it('is partial when some indicators failed', async () => {
    mocks.collectIndicators.mockResolvedValue({ collected: 5, failed: 2 });
    await runCollection();
    expect(lastStatus()).toBe('partial');
  });

  it('is partial when risk assessment was not performed', async () => {
    mocks.assessRisks.mockResolvedValue({ assessed: false });
    await runCollection();
    expect(lastStatus()).toBe('partial');
  });

  it('is partial and keeps going when summarization throws', async () => {
    mocks.summarizeUnsummarized.mockRejectedValue(new Error('llm down'));
    await runCollection();
    expect(lastStatus()).toBe('partial');
    expect(mocks.assessRisks).toHaveBeenCalled();
  });
});

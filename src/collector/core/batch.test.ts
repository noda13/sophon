import { describe, expect, it, vi } from 'vitest';
import { MAX_SUMMARY_ATTEMPTS, processInBatches } from './batch.js';

interface Item { id: number; summary?: string; summaryAttempts?: number }

const items = (n: number): Item[] => Array.from({ length: n }, (_, id) => ({ id }));

function setup() {
  const sleeps: number[] = [];
  const sleep = async (ms: number) => { sleeps.push(ms); };
  return { sleeps, sleep };
}

describe('processInBatches', () => {
  it('splits into batches of 10 with a 30s pause between them by default', async () => {
    const { sleeps, sleep } = setup();
    const sizes: number[] = [];
    const result = await processInBatches(items(25), async (b) => { sizes.push(b.length); }, { sleep });
    expect(sizes).toEqual([10, 10, 5]);
    expect(sleeps).toEqual([30_000, 30_000]);
    expect(result).toEqual({ attempted: 25, failed: 0, batches: 3 });
  });

  it('caps the number of items at max (default 50)', async () => {
    const { sleep } = setup();
    const seen: number[] = [];
    const result = await processInBatches(items(80), async (b) => { seen.push(...b.map((i) => i.id)); }, { sleep });
    expect(seen).toHaveLength(50);
    expect(seen[49]).toBe(49);
    expect(result.batches).toBe(5);
  });

  it('does not sleep after the last batch or when there is nothing to do', async () => {
    const { sleeps, sleep } = setup();
    await processInBatches(items(10), async () => {}, { sleep });
    await processInBatches([], async () => {}, { sleep });
    expect(sleeps).toEqual([]);
  });

  it('honors batchSize, intervalMs and max', async () => {
    const { sleeps, sleep } = setup();
    const sizes: number[] = [];
    await processInBatches(items(10), async (b) => { sizes.push(b.length); }, { batchSize: 3, intervalMs: 5, max: 7, sleep });
    expect(sizes).toEqual([3, 3, 1]);
    expect(sleeps).toEqual([5, 5]);
  });

  it('passes the batch index to the handler', async () => {
    const { sleep } = setup();
    const indexes: number[] = [];
    await processInBatches(items(25), async (_b, i) => { indexes.push(i); }, { sleep });
    expect(indexes).toEqual([0, 1, 2]);
  });

  it('rejects an invalid batchSize', async () => {
    await expect(processInBatches(items(1), async () => {}, { batchSize: 0 })).rejects.toThrow(RangeError);
  });

  it('keeps going after a failing batch, sleeps anyway, and reports it', async () => {
    const { sleeps, sleep } = setup();
    const onBatchError = vi.fn();
    const seen: number[] = [];
    const result = await processInBatches(items(25), async (b, i) => {
      if (i === 1) throw new Error('llm down');
      seen.push(b.length);
    }, { sleep, onBatchError });
    expect(seen).toEqual([10, 5]);
    expect(sleeps).toHaveLength(2);
    expect(onBatchError).toHaveBeenCalledTimes(1);
    expect(onBatchError.mock.calls[0]?.[1]).toBe(1);
    expect(result).toEqual({ attempted: 25, failed: 10, batches: 3 });
  });

  describe('with attemptsKey', () => {
    const opts = (sleep: (ms: number) => Promise<void>) => ({
      sleep,
      isDone: (i: Item) => !!i.summary,
      attemptsKey: 'summaryAttempts' as const,
    });

    it('increments attempts only for items the handler left undone', async () => {
      const { sleep } = setup();
      const list = items(4);
      const result = await processInBatches(list, async (b) => {
        for (const item of b) if (item.id % 2 === 0) item.summary = 'ok';
      }, opts(sleep));
      expect(list.map((i) => i.summaryAttempts)).toEqual([undefined, 1, undefined, 1]);
      expect(result).toEqual({ attempted: 4, failed: 2, batches: 1 });
    });

    it('counts an attempt for every item of a batch that threw while another batch succeeded', async () => {
      const { sleep } = setup();
      const list = items(3);
      await processInBatches(list, async (_b, i) => {
        if (i === 0) throw new Error('x');
        for (const item of _b) item.summary = 'ok';
      }, { ...opts(sleep), batchSize: 2, onBatchError: () => {} });
      expect(list.map((i) => i.summaryAttempts)).toEqual([1, 1, undefined]);
    });

    it('restores attempts when every batch threw (provider outage)', async () => {
      const { sleep } = setup();
      const list: Item[] = [{ id: 0 }, { id: 1, summaryAttempts: 1 }, { id: 2 }];
      const result = await processInBatches(list, async () => { throw new Error('quota'); }, { ...opts(sleep), batchSize: 2, onBatchError: () => {} });
      expect(list.map((i) => i.summaryAttempts)).toEqual([undefined, 1, undefined]);
      expect('summaryAttempts' in list[0]!).toBe(false);
      expect(result).toEqual({ attempted: 3, failed: 3, batches: 2 });
    });

    it('still counts attempts when only some batches threw', async () => {
      const { sleep } = setup();
      const list = items(4);
      await processInBatches(list, async (_b, i) => { if (i === 0) throw new Error('x'); }, { ...opts(sleep), batchSize: 2, onBatchError: () => {} });
      expect(list.map((i) => i.summaryAttempts)).toEqual([1, 1, 1, 1]);
    });

    it('keeps attempts for items left undone without a throw', async () => {
      const { sleep } = setup();
      const list = items(2);
      await processInBatches(list, async () => {}, opts(sleep));
      expect(list.map((i) => i.summaryAttempts)).toEqual([1, 1]);
    });

    it('skips items that reached the attempt limit and already-done items', async () => {
      const { sleep } = setup();
      const list: Item[] = [
        { id: 0, summaryAttempts: MAX_SUMMARY_ATTEMPTS },
        { id: 1, summary: 'done' },
        { id: 2, summaryAttempts: MAX_SUMMARY_ATTEMPTS - 1 },
        { id: 3 },
      ];
      const seen: number[] = [];
      const result = await processInBatches(list, async (b) => { seen.push(...b.map((i) => i.id)); }, opts(sleep));
      expect(seen).toEqual([2, 3]);
      expect(list[2]?.summaryAttempts).toBe(MAX_SUMMARY_ATTEMPTS);
      expect(result.attempted).toBe(2);
    });

    it('does not let capped-out items occupy the max budget', async () => {
      const { sleep } = setup();
      const list: Item[] = [
        ...Array.from({ length: 5 }, (_, id): Item => ({ id, summaryAttempts: MAX_SUMMARY_ATTEMPTS })),
        { id: 5 },
      ];
      const seen: number[] = [];
      await processInBatches(list, async (b) => { seen.push(...b.map((i) => i.id)); }, { ...opts(sleep), max: 1 });
      expect(seen).toEqual([5]);
    });

    it('honors a custom maxAttempts', async () => {
      const { sleep } = setup();
      const list: Item[] = [{ id: 0, summaryAttempts: 1 }];
      const handler = vi.fn(async () => {});
      await processInBatches(list, handler, { ...opts(sleep), maxAttempts: 1 });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('signal', () => {
    it('stops before the next batch once aborted and rejects with the reason', async () => {
      const { sleep } = setup();
      const controller = new AbortController();
      const seen: number[] = [];
      await expect(processInBatches(items(25), async (_b, i) => {
        seen.push(i);
        if (i === 0) controller.abort(new Error('budget'));
      }, { sleep, signal: controller.signal })).rejects.toThrow('budget');
      expect(seen).toEqual([0]);
    });

    it('rejects without running any batch when already aborted', async () => {
      const handler = vi.fn(async () => {});
      await expect(processInBatches(items(3), handler, { signal: AbortSignal.abort() })).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('interrupts the default inter-batch sleep', async () => {
      const controller = new AbortController();
      const promise = processInBatches(items(2), async () => { setTimeout(() => controller.abort(), 10); }, {
        batchSize: 1,
        intervalMs: 60_000,
        signal: controller.signal,
      });
      await expect(promise).rejects.toThrow();
    });
  });
});

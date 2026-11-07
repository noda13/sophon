import { processInBatches, type BatchOptions, type BatchResult } from '../../core/batch';

/** classify と ideas が共有する LLM 部分の合計時間。job の timeout より十分手前で打ち切る。 */
export const LLM_BUDGET_MS = 10 * 60_000;

export interface LlmBudget {
  /** 打ち切り時刻（epoch ms）。 */
  deadline: number;
  clock?: () => number;
}

export interface BudgetedBatchResult extends BatchResult {
  /** 予算切れで処理されず、次回に回した件数。attempted と failed には含めない。 */
  deferred: number;
}

class BudgetExceededError extends Error {}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// 進行中の LLM 呼び出しは中断しない（中断すると分類済みの見込みだった項目が失敗扱いになる）。
// バッチの開始前にだけ予算を確認し、超えていたらそのバッチの項目は試行回数を消費せず次回に回す。
export async function processInBatchesWithin<T>(
  items: T[],
  handler: (batch: T[], batchIndex: number) => Promise<void>,
  opts: BatchOptions<T> & { budget?: LlmBudget },
): Promise<BudgetedBatchResult> {
  const { budget, ...batchOpts } = opts;
  if (!budget) {
    return { ...(await processInBatches(items, handler, batchOpts)), deferred: 0 };
  }
  const clock = budget.clock ?? Date.now;
  const over = () => clock() >= budget.deadline;
  const key = batchOpts.attemptsKey as PropertyKey | undefined;
  const deferred = new Map<T, unknown>();

  const result = await processInBatches(
    items,
    async (batch, index) => {
      if (over()) {
        for (const item of batch) deferred.set(item, key ? (item as Record<PropertyKey, unknown>)[key] : undefined);
        throw new BudgetExceededError('LLM budget exceeded');
      }
      await handler(batch, index);
    },
    {
      ...batchOpts,
      onBatchError: (error, index) => {
        if (error instanceof BudgetExceededError) return;
        batchOpts.onBatchError?.(error, index);
      },
      sleep: async (ms) => {
        if (over()) return;
        await (batchOpts.sleep ?? ((n: number) => abortableSleep(n, batchOpts.signal)))(ms);
      },
    },
  );

  if (key) {
    for (const [item, original] of deferred) {
      const record = item as Record<PropertyKey, unknown>;
      if (original === undefined) delete record[key];
      else record[key] = original;
    }
  }
  return {
    attempted: result.attempted - deferred.size,
    failed: result.failed - deferred.size,
    batches: result.batches,
    deferred: deferred.size,
  };
}

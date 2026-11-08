export const DEFAULT_BATCH_SIZE = 10;
export const DEFAULT_INTERVAL_MS = 30_000;
export const DEFAULT_MAX_ITEMS = 50;
export const MAX_SUMMARY_ATTEMPTS = 3;

type NumericKey<T> = { [K in keyof T]-?: T[K] extends number | undefined ? K : never }[keyof T];

export interface BatchOptions<T> {
  batchSize?: number;
  intervalMs?: number;
  /** 1 回の実行で処理する件数の上限。 */
  max?: number;
  sleep?: (ms: number) => Promise<void>;
  /** 処理済みの判定。省略時は handler が throw しなければ成功とみなす。 */
  isDone?: (item: T) => boolean;
  /** 失敗した項目の試行回数を数えるフィールド（例: summaryAttempts）。上限に達した項目は次回以降の対象から外れる。 */
  attemptsKey?: NumericKey<T>;
  maxAttempts?: number;
  onBatchError?: (error: unknown, batchIndex: number) => void;
  /** 各バッチと待機の前に確認し、abort 済みなら abort 理由で reject する。 */
  signal?: AbortSignal;
}

export interface BatchResult {
  attempted: number;
  failed: number;
  batches: number;
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
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

export async function processInBatches<T>(
  items: T[],
  handler: (batch: T[], batchIndex: number) => Promise<void>,
  opts: BatchOptions<T> = {},
): Promise<BatchResult> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const max = opts.max ?? DEFAULT_MAX_ITEMS;
  const maxAttempts = opts.maxAttempts ?? MAX_SUMMARY_ATTEMPTS;
  const sleep = opts.sleep ?? ((ms: number) => abortableSleep(ms, opts.signal));
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new RangeError(`batchSize must be a positive integer: ${batchSize}`);

  const attemptsOf = (item: T): number =>
    opts.attemptsKey ? ((item as Record<PropertyKey, unknown>)[opts.attemptsKey] as number | undefined) ?? 0 : 0;

  const targets = items
    .filter((item) => !opts.isDone?.(item) && attemptsOf(item) < maxAttempts)
    .slice(0, max);

  const failedItems = new Set<T>();
  const originalAttempts = new Map<T, number | undefined>();
  let batches = 0;
  let threwBatches = 0;
  for (let i = 0; i < targets.length; i += batchSize) {
    opts.signal?.throwIfAborted();
    const batch = targets.slice(i, i + batchSize);
    const batchIndex = batches++;
    let threw = false;
    try {
      await handler(batch, batchIndex);
    } catch (error) {
      threw = true;
      threwBatches++;
      if (opts.onBatchError) opts.onBatchError(error, batchIndex);
      else console.error(`  Batch ${batchIndex + 1} failed:`, error instanceof Error ? error.message : error);
    }

    for (const item of batch) {
      const done = opts.isDone ? opts.isDone(item) : !threw;
      if (done) continue;
      failedItems.add(item);
      // 恒常的に失敗する項目が毎回の処理枠と出力 JSON を占有し続けないよう、試行回数で打ち切る。
      if (opts.attemptsKey) {
        originalAttempts.set(item, (item as Record<PropertyKey, unknown>)[opts.attemptsKey] as number | undefined);
        (item as Record<PropertyKey, unknown>)[opts.attemptsKey] = attemptsOf(item) + 1;
      }
    }

    // レート制限を避けるため、成否にかかわらず次のバッチの前に待つ。
    if (i + batchSize < targets.length) {
      opts.signal?.throwIfAborted();
      await sleep(intervalMs);
    }
  }

  // 全バッチが throw したのはプロバイダ全面障害（障害・クォータ切れ・キー失効）とみなす。項目の責任ではないので、障害の日数ぶん試行回数を消費して恒久的に諦めることがないよう戻す。
  if (opts.attemptsKey && targets.length > 0 && threwBatches === batches) {
    for (const [item, original] of originalAttempts) {
      const record = item as Record<PropertyKey, unknown>;
      if (original === undefined) delete record[opts.attemptsKey];
      else record[opts.attemptsKey] = original;
    }
  }
  return { attempted: targets.length, failed: failedItems.size, batches };
}

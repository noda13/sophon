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
}

export interface BatchResult {
  attempted: number;
  failed: number;
  batches: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function processInBatches<T>(
  items: T[],
  handler: (batch: T[], batchIndex: number) => Promise<void>,
  opts: BatchOptions<T> = {},
): Promise<BatchResult> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const max = opts.max ?? DEFAULT_MAX_ITEMS;
  const maxAttempts = opts.maxAttempts ?? MAX_SUMMARY_ATTEMPTS;
  const sleep = opts.sleep ?? defaultSleep;
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new RangeError(`batchSize must be a positive integer: ${batchSize}`);

  const attemptsOf = (item: T): number =>
    opts.attemptsKey ? ((item as Record<PropertyKey, unknown>)[opts.attemptsKey] as number | undefined) ?? 0 : 0;

  const targets = items
    .filter((item) => !opts.isDone?.(item) && attemptsOf(item) < maxAttempts)
    .slice(0, max);

  const failedItems = new Set<T>();
  let batches = 0;
  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    const batchIndex = batches++;
    let threw = false;
    try {
      await handler(batch, batchIndex);
    } catch (error) {
      threw = true;
      if (opts.onBatchError) opts.onBatchError(error, batchIndex);
      else console.error(`  Batch ${batchIndex + 1} failed:`, error instanceof Error ? error.message : error);
    }

    for (const item of batch) {
      const done = opts.isDone ? opts.isDone(item) : !threw;
      if (done) continue;
      failedItems.add(item);
      // 恒常的に失敗する項目が毎回の処理枠と出力 JSON を占有し続けないよう、試行回数で打ち切る。
      if (opts.attemptsKey) (item as Record<PropertyKey, unknown>)[opts.attemptsKey] = attemptsOf(item) + 1;
    }

    // レート制限を避けるため、成否にかかわらず次のバッチの前に待つ。
    if (i + batchSize < targets.length) await sleep(intervalMs);
  }
  return { attempted: targets.length, failed: failedItems.size, batches };
}

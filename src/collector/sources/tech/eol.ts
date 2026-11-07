import pRetry from 'p-retry';
import { z } from 'zod';
import { EOL_NO_DATE_DAYS, type EolItem } from '../../../shared/schema/tech';
import { HttpStatusError } from '../../core/rss';

// typescript は endoflife.date に存在せず（404）、残すと毎回の実行が partial になるため外してある。
export const EOL_PRODUCTS = [
  { id: 'nodejs', label: 'Node.js' },
  { id: 'python', label: 'Python' },
  { id: 'php', label: 'PHP' },
  { id: 'ubuntu', label: 'Ubuntu' },
  { id: 'django', label: 'Django' },
  { id: 'kubernetes', label: 'Kubernetes' },
  { id: 'redis', label: 'Redis' },
  { id: 'go', label: 'Go' },
  { id: 'react', label: 'React' },
] as const;

export interface EolProduct {
  id: string;
  label: string;
}

export const ACTIVE_CYCLES_PER_PRODUCT = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// endoflife.date は cycle を数値で返す製品がある。eol: true は日付なしで終了済みの意味。
const CycleSchema = z.object({
  cycle: z.union([z.string(), z.number()]).transform(String),
  eol: z.union([z.string(), z.boolean()]),
  latest: z.string().optional(),
});
const CyclesSchema = z.array(CycleSchema);
export type EndOfLifeCycle = z.infer<typeof CycleSchema>;

export function computeDaysLeft(eol: string | false, today: Date): number {
  if (eol === false) return EOL_NO_DATE_DAYS;
  const days = Math.round((new Date(eol).getTime() - today.getTime()) / MS_PER_DAY);
  return Math.min(days, EOL_NO_DATE_DAYS - 1);
}

// 無期限のサポート（eol: false）を先頭に、その後は EOL が遠い順に並べて上位だけ残す。
export function selectActiveCycles(cycles: readonly EndOfLifeCycle[], today: Date, limit = ACTIVE_CYCLES_PER_PRODUCT): EndOfLifeCycle[] {
  const eolTime = (c: EndOfLifeCycle) => new Date(c.eol as string).getTime();
  return cycles
    .filter((c) => c.eol === false || (typeof c.eol === 'string' && eolTime(c) > today.getTime()))
    .sort((a, b) => {
      if (a.eol === false && b.eol === false) return 0;
      if (a.eol === false) return -1;
      if (b.eol === false) return 1;
      return eolTime(b) - eolTime(a);
    })
    .slice(0, limit);
}

export function toEolItems(label: string, cycles: readonly EndOfLifeCycle[], today: Date): EolItem[] {
  return selectActiveCycles(cycles, today).map((c) => ({
    product: label,
    cycle: c.cycle,
    eol: c.eol as string | false,
    ...(c.latest !== undefined ? { latest: c.latest } : {}),
    daysLeft: computeDaysLeft(c.eol as string | false, today),
  }));
}

// 取得に失敗した製品は前回の値を引き継ぐ。ただし日数は今日の時点に計算し直し、すでに EOL の cycle は落とす。
export function carryForward(prev: readonly EolItem[], label: string, today: Date): EolItem[] {
  return prev
    .filter((item) => item.product === label)
    .map((item) => ({ ...item, daysLeft: computeDaysLeft(item.eol, today) }))
    .filter((item) => item.daysLeft >= 0);
}

export interface CollectEolOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** 最初の試行に加える再試行の回数（429、5xx、timeout、ネットワークエラーのみ）。 */
  retries?: number;
  minRetryDelayMs?: number;
}

export interface CollectEolResult {
  items: EolItem[];
  failedProducts: string[];
  /** failedProducts の label をキーにした、短い失敗理由。 */
  failureReasons: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MIN_RETRY_DELAY_MS = 1_000;

function isRetryable(error: Error): boolean {
  if (error instanceof HttpStatusError) return error.status === 429 || error.status >= 500;
  return error instanceof TypeError || error.name === 'TimeoutError';
}

export function shortReason(error: unknown): string {
  if (error instanceof HttpStatusError) return `HTTP ${error.status}`;
  if (error instanceof z.ZodError) return 'unexpected response shape';
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'timeout';
    if (error.name === 'AbortError') return 'aborted';
    if (error instanceof TypeError) return 'network error';
    return error.message.slice(0, 100);
  }
  return String(error).slice(0, 100);
}

async function fetchCycles(product: EolProduct, opts: CollectEolOptions): Promise<unknown> {
  return pRetry(
    async () => {
      const url = `https://endoflife.date/api/${product.id}.json`;
      const timeout = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Sophon/1.0' },
        signal: opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout,
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new HttpStatusError(res.status, url);
      }
      return res.json();
    },
    {
      retries: opts.retries ?? DEFAULT_RETRIES,
      minTimeout: opts.minRetryDelayMs ?? DEFAULT_MIN_RETRY_DELAY_MS,
      signal: opts.signal,
      shouldRetry: ({ error }) => isRetryable(error),
    },
  );
}

export async function collectEol(
  prev: readonly EolItem[],
  today: Date,
  products: readonly EolProduct[] = EOL_PRODUCTS,
  opts: CollectEolOptions = {},
): Promise<CollectEolResult> {
  const failedProducts: string[] = [];
  const failureReasons: Record<string, string> = {};
  const perProduct = await Promise.all(
    products.map(async (product): Promise<EolItem[]> => {
      try {
        return toEolItems(product.label, CyclesSchema.parse(await fetchCycles(product, opts)), today);
      } catch (e) {
        const reason = shortReason(e);
        console.warn(`  ${product.label}: fetch failed (${reason}), using cache`);
        failedProducts.push(product.label);
        failureReasons[product.label] = reason;
        return carryForward(prev, product.label, today);
      }
    }),
  );
  return { items: perProduct.flat(), failedProducts, failureReasons };
}

import pRetry from 'p-retry';
import type { EconomicIndicator } from '../../../shared/schema/econ';

export const ASSETS = [
  { code: 'DJIA', name: 'NYダウ', symbol: '^DJI', unit: 'pt' },
  { code: 'SPX', name: 'S&P500', symbol: '^GSPC', unit: 'pt' },
  { code: 'TOPIX', name: 'TOPIX(ETF)', symbol: '1306.T', unit: '円' },
  { code: 'USDJPY', name: 'ドル円', symbol: 'USDJPY=X', unit: '円' },
  { code: 'VIX', name: '恐怖指数(VIX)', symbol: '^VIX', unit: 'pt' },
  { code: 'UST10Y', name: '米10年債利回り', symbol: '^TNX', unit: '%' },
  { code: 'UST3M', name: '米3ヶ月債利回り', symbol: '^IRX', unit: '%' },
  { code: 'WTI', name: '原油(WTI)', symbol: 'CL=F', unit: 'USD' },
  { code: 'GOLD', name: '金', symbol: 'GC=F', unit: 'USD' },
  { code: 'HYG', name: 'HY社債ETF', symbol: 'HYG', unit: 'USD' },
] as const;

interface YahooQuote {
  price: number;
  prevClose: number | null;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
}

const YAHOO_TIMEOUT_MS = 10_000;
// 10 本を同時に撃つと一過性の 429 を踏みやすいので並行数を絞る。
const YAHOO_CONCURRENCY = 3;
const YAHOO_RETRIES = 2;
const YAHOO_MIN_RETRY_DELAY_MS = 500;

class YahooHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'YahooHttpError';
  }
}

class YahooPayloadError extends Error {}

function isRetryable(error: Error): boolean {
  if (error instanceof YahooHttpError) return error.status === 429 || error.status >= 500;
  // fetch は network 障害で TypeError、timeout で TimeoutError を投げる。
  return error instanceof TypeError || error.name === 'TimeoutError';
}

function describeFailure(error: unknown): string {
  if (error instanceof YahooHttpError || error instanceof YahooPayloadError) return error.message;
  if (error instanceof Error && error.name === 'TimeoutError') return 'timeout';
  if (error instanceof TypeError) return 'network error';
  if (error instanceof SyntaxError) return 'invalid JSON';
  return 'unexpected error';
}

export interface IndicatorFailure {
  code: string;
  reason: string;
}

export interface CollectIndicatorsOptions {
  signal?: AbortSignal;
  retries?: number;
  minRetryDelayMs?: number;
  /** 取得に失敗した指標の code と短い理由を受け取る。 */
  failures?: IndicatorFailure[];
}

async function fetchYahoo(symbol: string, opts: CollectIndicatorsOptions): Promise<YahooQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  return pRetry(
    async () => {
      const timeout = AbortSignal.timeout(YAHOO_TIMEOUT_MS);
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Sophon/1.0)' },
        signal: opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout,
      });
      if (!r.ok) {
        await r.body?.cancel();
        throw new YahooHttpError(r.status);
      }
      const data = (await r.json()) as YahooChartResponse;
      const result = data.chart?.result?.[0];
      const price = result?.meta?.regularMarketPrice;
      if (typeof price !== 'number') throw new YahooPayloadError('no price in response');
      const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => typeof c === 'number');
      return { price, prevClose: closes.length >= 2 ? (closes[closes.length - 2] ?? null) : null };
    },
    {
      retries: opts.retries ?? YAHOO_RETRIES,
      minTimeout: opts.minRetryDelayMs ?? YAHOO_MIN_RETRY_DELAY_MS,
      signal: opts.signal,
      shouldRetry: ({ error }) => isRetryable(error),
    },
  );
}

async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// An indicator that cannot be fetched keeps its cached value with `stale: true`, so the scoring
// ignores it while the dashboard can still show the last known number.
// signal が abort されたら残りは取得せず reject する（run 全体が打ち切られているため）。
export async function collectIndicators(
  prev: readonly EconomicIndicator[],
  now: Date,
  opts: CollectIndicatorsOptions = {},
): Promise<EconomicIndicator[]> {
  const pMap = new Map(prev.map((i) => [i.code, i]));
  const recordedAt = now.toISOString();

  const entries = await mapWithConcurrency(ASSETS, YAHOO_CONCURRENCY, async (asset): Promise<EconomicIndicator | null> => {
    opts.signal?.throwIfAborted();
    let q: YahooQuote | null = null;
    let reason = '';
    try {
      q = await fetchYahoo(asset.symbol, opts);
    } catch (error) {
      opts.signal?.throwIfAborted();
      reason = describeFailure(error);
    }
    if (q) {
      return {
        code: asset.code,
        name: asset.name,
        value: q.price,
        previousValue: q.prevClose ?? pMap.get(asset.code)?.value ?? null,
        unit: asset.unit,
        source: 'yahoo',
        recordedAt,
      };
    }
    opts.failures?.push({ code: asset.code, reason });
    const fallback = pMap.get(asset.code);
    if (fallback) {
      console.warn(`  fetchYahoo(${asset.symbol}) failed (${reason}); carrying forward cached value as stale`);
      return { ...fallback, stale: true };
    }
    console.warn(`  fetchYahoo(${asset.symbol}) failed (${reason}); no cached value`);
    return null;
  });

  return entries.filter((e): e is EconomicIndicator => e !== null);
}

export function unavailableIndicators(indicators: readonly EconomicIndicator[]): string[] {
  return ASSETS.filter((a) => !indicators.some((i) => i.code === a.code && !i.stale)).map((a) => a.code);
}

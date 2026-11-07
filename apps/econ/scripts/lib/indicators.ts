import type { EconomicIndicator } from './types.js';

export const ASSETS = [
  { code: 'DJIA',   name: 'NYダウ',         symbol: '^DJI',     unit: 'pt' },
  { code: 'SPX',    name: 'S&P500',         symbol: '^GSPC',    unit: 'pt' },
  { code: 'TOPIX',  name: 'TOPIX(ETF)',     symbol: '1306.T',   unit: '円' },
  { code: 'USDJPY', name: 'ドル円',         symbol: 'USDJPY=X', unit: '円' },
  { code: 'VIX',    name: '恐怖指数(VIX)',  symbol: '^VIX',     unit: 'pt' },
  { code: 'UST10Y', name: '米10年債利回り', symbol: '^TNX',     unit: '%' },
  { code: 'UST3M',  name: '米3ヶ月債利回り', symbol: '^IRX',   unit: '%' },
  { code: 'WTI',    name: '原油(WTI)',       symbol: 'CL=F',    unit: 'USD' },
  { code: 'GOLD',   name: '金',             symbol: 'GC=F',     unit: 'USD' },
  { code: 'HYG',    name: 'HY社債ETF',      symbol: 'HYG',     unit: 'USD' },
] as const;

interface YahooQuote { price: number; prevClose: number | null }

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
}

async function fetchYahoo(symbol: string): Promise<YahooQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Econoguard/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const data = await r.json() as YahooChartResponse;
    const result = data.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    if (typeof price !== 'number') return null;
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => typeof c === 'number');
    return { price, prevClose: closes.length >= 2 ? closes[closes.length - 2] : null };
  } catch { return null; }
}

export async function collectIndicators(prev: EconomicIndicator[]): Promise<EconomicIndicator[]> {
  const pMap = new Map(prev.map(i => [i.code, i]));
  const now = new Date().toISOString();

  const entries = await Promise.all(
    ASSETS.map(async (asset): Promise<EconomicIndicator | null> => {
      const q = await fetchYahoo(asset.symbol);
      if (q) {
        return {
          code: asset.code,
          name: asset.name,
          value: q.price,
          previousValue: q.prevClose ?? pMap.get(asset.code)?.value ?? null,
          unit: asset.unit,
          source: 'yahoo',
          recordedAt: now,
        };
      }
      const fallback = pMap.get(asset.code);
      if (fallback) {
        console.warn(`  fetchYahoo(${asset.symbol}) failed; carrying forward cached value as stale`);
        return { ...fallback, stale: true };
      }
      console.warn(`  fetchYahoo(${asset.symbol}) failed; no cached value`);
      return null;
    }),
  );

  return entries.filter((e): e is EconomicIndicator => e !== null);
}

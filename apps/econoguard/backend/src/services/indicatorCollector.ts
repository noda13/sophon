import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';

interface FetchedIndicator {
  value: number;
  previousValue: number | null;
}

interface IndicatorDefinition {
  code: string;
  name: string;
  unit: string;
  source: string;
  fetch: () => Promise<FetchedIndicator | null>;
}

async function fetchFRED(seriesId: string, units?: string): Promise<FetchedIndicator | null> {
  if (!config.fredApiKey) {
    console.log(`FRED API key not configured, skipping ${seriesId}`);
    return null;
  }

  try {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('series_id', seriesId);
    url.searchParams.set('api_key', config.fredApiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('sort_order', 'desc');
    // Latest observations can be '.' (not yet published), so look past the first row.
    url.searchParams.set('limit', '5');
    if (units) url.searchParams.set('units', units);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`FRED responded with ${response.status}`);

    const data = await response.json() as {
      observations?: Array<{ value?: string }>;
    };

    const values = (data.observations ?? [])
      .map((o) => (o.value && o.value !== '.' ? parseFloat(o.value) : NaN))
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;
    return { value: values[0], previousValue: values[1] ?? null };
  } catch (error) {
    console.error(`Failed to fetch FRED ${seriesId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchCoinGecko(coinId: string): Promise<FetchedIndicator | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Econoguard/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`CoinGecko responded with ${response.status}`);

    const data = await response.json() as Record<string, { usd?: number }>;
    const value = data[coinId]?.usd;
    return typeof value === 'number' ? { value, previousValue: null } : null;
  } catch (error) {
    console.error(`Failed to fetch CoinGecko ${coinId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchExchangeRate(currency: string): Promise<FetchedIndicator | null> {
  if (!config.openExchangeRatesAppId) {
    console.log('Open Exchange Rates key not configured, skipping');
    return null;
  }

  try {
    const url = `https://openexchangerates.org/api/latest.json?app_id=${config.openExchangeRatesAppId}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`OpenExchangeRates responded with ${response.status}`);

    const data = await response.json() as { rates?: Record<string, number> };
    const value = data.rates?.[currency];
    return typeof value === 'number' ? { value, previousValue: null } : null;
  } catch (error) {
    console.error(`Failed to fetch exchange rate for ${currency}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchYahooChart(symbol: string): Promise<FetchedIndicator | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Econoguard/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Yahoo Finance responded with ${response.status}`);

    const data = await response.json() as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };

    const result = data.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    if (typeof price !== 'number') return null;

    const closes = (result?.indicators?.quote?.[0]?.close ?? [])
      .filter((c): c is number => typeof c === 'number');
    return { value: price, previousValue: closes.length >= 2 ? closes[closes.length - 2] : null };
  } catch (error) {
    console.error(`Failed to fetch Yahoo ${symbol}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

const indicators: IndicatorDefinition[] = [
  {
    code: 'VIX',
    name: 'VIX恐怖指数',
    unit: '',
    source: 'fred',
    fetch: () => fetchFRED('VIXCLS'),
  },
  {
    code: 'US_CPI',
    name: '米国CPI（前年比）',
    unit: '%',
    source: 'fred',
    fetch: () => fetchFRED('CPIAUCSL', 'pc1'),
  },
  {
    code: 'US_FFR',
    name: '米国政策金利',
    unit: '%',
    source: 'fred',
    fetch: () => fetchFRED('FEDFUNDS'),
  },
  {
    code: 'US10Y',
    name: '米10年国債利回り',
    unit: '%',
    source: 'fred',
    fetch: () => fetchFRED('DGS10'),
  },
  {
    code: 'GOLD',
    name: '金価格',
    unit: 'USD/oz',
    source: 'yahoo',
    fetch: () => fetchYahooChart('GC=F'),
  },
  {
    code: 'USDJPY',
    name: 'ドル円',
    unit: '円',
    source: 'openexchangerates',
    fetch: () => fetchExchangeRate('JPY'),
  },
  {
    code: 'BTC',
    name: 'ビットコイン',
    unit: 'USD',
    source: 'coingecko',
    fetch: () => fetchCoinGecko('bitcoin'),
  },
  {
    code: 'ETH',
    name: 'イーサリアム',
    unit: 'USD',
    source: 'coingecko',
    fetch: () => fetchCoinGecko('ethereum'),
  },
];

export const INDICATOR_CODES = indicators.map((i) => i.code);

async function getPreviousValue(code: string, before: Date): Promise<number | null> {
  const prev = await prisma.economicIndicator.findFirst({
    where: { code, recordedAt: { lt: before } },
    orderBy: { recordedAt: 'desc' },
  });
  return prev?.value ?? null;
}

export async function collectIndicators(): Promise<{ collected: number; failed: number }> {
  const now = new Date();
  // Truncate to the hour for recordedAt to avoid unique constraint issues on rapid re-runs
  now.setMinutes(0, 0, 0);

  console.log('Fetching all indicators in parallel...');
  const fetchResults = await Promise.allSettled(
    indicators.map(async (indicator) => {
      console.log(`Fetching indicator: ${indicator.code}...`);
      const fetched = await indicator.fetch();
      return { indicator, fetched };
    }),
  );

  let collected = 0;
  let failed = 0;

  for (const result of fetchResults) {
    if (result.status === 'rejected') {
      console.error(`Failed to fetch indicator:`, result.reason instanceof Error ? result.reason.message : result.reason);
      failed++;
      continue;
    }

    const { indicator, fetched } = result.value;

    try {
      if (fetched === null) {
        console.log(`  -> ${indicator.code}: no data`);
        failed++;
        continue;
      }

      const { value } = fetched;
      const previousValue = fetched.previousValue ?? await getPreviousValue(indicator.code, now);

      await prisma.economicIndicator.upsert({
        where: {
          code_recordedAt: {
            code: indicator.code,
            recordedAt: now,
          },
        },
        update: { value, previousValue },
        create: {
          code: indicator.code,
          name: indicator.name,
          value,
          previousValue,
          unit: indicator.unit,
          source: indicator.source,
          recordedAt: now,
        },
      });

      console.log(`  -> ${indicator.code}: ${value} ${indicator.unit}`);
      collected++;
    } catch (error) {
      console.error(`Failed to collect ${indicator.code}:`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log(`Indicator collection complete: ${collected} collected, ${failed} failed`);
  return { collected, failed };
}

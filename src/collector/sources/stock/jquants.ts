import pRetry from 'p-retry';

const DEFAULT_BASE_URL = 'https://api.jquants.com/v2';
const MS_PER_DAY = 24 * 3_600_000;

// The free tier serves data 12 weeks behind real time and rejects later dates with HTTP 400.
export const FREE_TIER_LAG_DAYS = 84;
export const DEFAULT_HISTORY_DAYS = 120;

// Free tier allows 5 requests/min; J-Quants blocks for ~5 minutes when that is exceeded by a wide margin.
const DEFAULT_REQUEST_INTERVAL_MS = 13_000;
const SLOW_DURATION_MS = 10 * 60 * 1000;
const CONSECUTIVE_OK_TO_SPEEDUP = 30;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT_DELAYS_MS = [10_000, 30_000, 60_000];
const DEFAULT_SERVER_ERROR_DELAYS_MS = [2_000, 4_000, 8_000];
const MAX_RETRY_AFTER_MS = 120_000;
const MAX_PAGES = 500;
// Individual weekdays may fail (e.g. a holiday the API rejects); a larger share means the data is unreliable.
const MAX_FAILED_STATEMENT_DAY_RATIO = 0.1;

export interface StockInfo {
  code: string;
  name: string;
  sector33Name?: string;
  sector33Code?: string;
  sector17Code?: string;
  marketSegment?: string;
  scaleCategory?: string;
  sharesOutstanding: number;
}

export interface StatementRaw {
  code: string;
  fiscalYear: number;
  typeOfCurrentPeriod: string;
  disclosedDate: Date;
  periodEndDate: Date;
  netSales: number | null;
  operatingProfit: number | null;
  ordinaryProfit: number | null;
  profit: number | null;
  totalAssets: number | null;
  equity: number | null;
  currentAssets: number | null;
  cashAndEquivalents: number | null;
  sharesOutstanding: number | null;
}

export interface PriceRaw {
  code: string;
  date: Date;
  close: number;
}

export interface MarketData {
  stocks: StockInfo[];
  statements: Map<string, StatementRaw[]>;
  prices: Map<string, PriceRaw>;
  apiCalls: number;
  errors: string[];
}

export interface JQuantsOptions {
  apiKey: string;
  baseUrl?: string;
  requestIntervalMs?: number;
  timeoutMs?: number;
  rateLimitDelaysMs?: number[];
  serverErrorDelaysMs?: number[];
  fetch?: typeof fetch;
}

export class JQuantsHttpError extends Error {
  constructor(
    readonly status: number,
    readonly label: string,
    body: string,
    readonly retryAfterMs?: number,
  ) {
    super(`[jquants] HTTP ${status} [${label}]: ${body.slice(0, 200)}`);
    this.name = 'JQuantsHttpError';
  }
}

type Row = Record<string, string | number | undefined>;

function parseNum(v: string | number | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? null : v;
  if (v.trim() === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

function parseDate(v: string | undefined): Date {
  if (!v) return new Date(0);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

// J-Quants returns 5-digit codes ("72030"); the app uses the 4-digit form.
export function normalizeCode(rawCode: string): string {
  return rawCode.slice(0, 4);
}

function isRetryable(error: Error): boolean {
  if (error instanceof JQuantsHttpError) return error.status === 429 || error.status >= 500;
  return error instanceof TypeError || error.name === 'TimeoutError';
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function isWeekend(d: Date): boolean {
  return d.getUTCDay() === 0 || d.getUTCDay() === 6;
}

function previousWeekday(d: Date): Date {
  const out = new Date(d);
  while (isWeekend(out)) out.setTime(out.getTime() - MS_PER_DAY);
  return out;
}

function toStatement(code: string, item: Row): StatementRaw | null {
  const docType = String(item['DocType'] ?? item['TypeOfDocument'] ?? '');
  if (!docType.includes('FinancialStatements')) return null;

  const issued = parseNum(
    item['ShOutFY'] ?? item['NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock'],
  );
  const treasury = parseNum(item['TrShFY'] ?? item['NumberOfTreasuryStockAtTheEndOfFiscalYear']);
  const periodEndRaw = (item['CurPerEn'] ?? item['CurrentPeriodEndDate']) as string | undefined;
  const periodEndDate = parseDate(periodEndRaw);

  return {
    code,
    fiscalYear: periodEndRaw ? periodEndDate.getUTCFullYear() : 0,
    typeOfCurrentPeriod: String(item['CurPerType'] ?? item['TypeOfCurrentPeriod'] ?? ''),
    disclosedDate: parseDate((item['DiscDate'] ?? item['DisclosedDate']) as string | undefined),
    periodEndDate,
    netSales: parseNum(item['Sales'] ?? item['NetSales']),
    operatingProfit: parseNum(item['OP'] ?? item['OperatingProfit']),
    ordinaryProfit: parseNum(item['OdP'] ?? item['OrdinaryProfit']),
    profit: parseNum(item['NP'] ?? item['Profit']),
    totalAssets: parseNum(item['TA'] ?? item['TotalAssets']),
    equity: parseNum(item['Eq'] ?? item['Equity']),
    currentAssets: parseNum(item['CA'] ?? item['CurrentAssets']),
    cashAndEquivalents: parseNum(item['CashEq'] ?? item['CashAndEquivalents']),
    sharesOutstanding: issued !== null && treasury !== null ? issued - treasury : issued,
  };
}

export interface JQuantsClient {
  readonly requestCount: number;
  listStocks(): Promise<StockInfo[]>;
  fetchPrices(date: Date): Promise<Map<string, PriceRaw>>;
  fetchStatementsOn(date: Date): Promise<StatementRaw[]>;
}

export function createJQuantsClient(opts: JQuantsOptions): JQuantsClient {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const normalInterval = opts.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
  const slowInterval = Math.max(normalInterval * 2, normalInterval === 0 ? 0 : 20_000);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rateLimitDelays = opts.rateLimitDelaysMs ?? DEFAULT_RATE_LIMIT_DELAYS_MS;
  const serverErrorDelays = opts.serverErrorDelaysMs ?? DEFAULT_SERVER_ERROR_DELAYS_MS;
  const doFetch = opts.fetch ?? fetch;

  let lastRequestAt = 0;
  let slowModeUntil = 0;
  let consecutiveOk = 0;
  let requestCount = 0;
  let pacing: Promise<void> = Promise.resolve();

  const currentInterval = () => (Date.now() < slowModeUntil ? slowInterval : normalInterval);

  function throttle(): Promise<void> {
    const next = pacing.then(async () => {
      const wait = currentInterval() - (Date.now() - lastRequestAt);
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();
    });
    pacing = next.catch(() => undefined);
    return next;
  }

  async function request(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const label = `${path}${url.search}`;

    return pRetry(
      async () => {
        await throttle();
        requestCount++;
        const res = await doFetch(url, {
          headers: { 'x-api-key': opts.apiKey },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new JQuantsHttpError(res.status, label, body, parseRetryAfter(res.headers.get('retry-after')));
        }
        consecutiveOk++;
        if (consecutiveOk >= CONSECUTIVE_OK_TO_SPEEDUP) slowModeUntil = 0;
        return (await res.json()) as Record<string, unknown>;
      },
      {
        retries: Math.max(rateLimitDelays.length, serverErrorDelays.length),
        // p-retry's exponential backoff cannot express "10s/30s/60s for 429, 2s/4s/8s for 5xx",
        // so the wait happens in onFailedAttempt and p-retry only counts attempts.
        minTimeout: 0,
        shouldRetry: ({ error }) => isRetryable(error),
        onFailedAttempt: async ({ error, attemptNumber, retriesLeft }) => {
          const index = attemptNumber - 1;
          let wait: number | undefined;
          if (error instanceof JQuantsHttpError && error.status === 429) {
            consecutiveOk = 0;
            slowModeUntil = Date.now() + SLOW_DURATION_MS;
            wait = error.retryAfterMs !== undefined
              ? Math.min(error.retryAfterMs, MAX_RETRY_AFTER_MS)
              : rateLimitDelays[index];
          } else if (isRetryable(error)) {
            wait = serverErrorDelays[index];
          }
          // p-retry calls this before deciding whether to retry; waiting before the final throw only delays the failure.
          if (retriesLeft > 0 && isRetryable(error) && wait !== undefined && wait > 0) await sleep(wait);
        },
      },
    );
  }

  async function getPaginated(path: string, params: Record<string, string>): Promise<Row[]> {
    const results: Row[] = [];
    const query = { ...params };
    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await request(path, query);
      const items = response['data'];
      if (Array.isArray(items)) results.push(...(items as Row[]));
      const next = response['pagination_key'];
      if (typeof next !== 'string' || next === '') return results;
      query['pagination_key'] = next;
    }
    throw new Error(`[jquants] pagination exceeded ${MAX_PAGES} pages for ${path}`);
  }

  return {
    get requestCount() {
      return requestCount;
    },

    async listStocks() {
      const items = await getPaginated('/equities/master', {});
      return items.map((item) => ({
        code: normalizeCode(String(item['Code'] ?? '')),
        name: String(item['CoName'] ?? item['CompanyName'] ?? item['Name'] ?? ''),
        sector33Code: asString(item['S33'] ?? item['Sector33Code']),
        sector33Name: asString(item['S33Nm'] ?? item['Sector33CodeName']),
        sector17Code: asString(item['S17'] ?? item['Sector17Code']),
        marketSegment: asString(item['MktNm'] ?? item['MarketCodeName'] ?? item['MarketSegment']),
        scaleCategory: asString(item['ScaleCat'] ?? item['ScaleCategory']),
        // /equities/master has no share count; it comes from each statement.
        sharesOutstanding: 0,
      }));
    },

    async fetchPrices(date) {
      const items = await getPaginated('/equities/bars/daily', { date: formatDate(date) });
      const prices = new Map<string, PriceRaw>();
      for (const item of items) {
        const close = parseNum(item['C'] ?? item['Close']);
        const dateStr = item['Date'] as string | undefined;
        if (!close || !dateStr) continue;
        const code = normalizeCode(String(item['Code'] ?? ''));
        prices.set(code, { code, date: parseDate(dateStr), close });
      }
      return prices;
    },

    async fetchStatementsOn(date) {
      const items = await getPaginated('/fins/summary', { date: formatDate(date) });
      const out: StatementRaw[] = [];
      for (const item of items) {
        const stmt = toStatement(normalizeCode(String(item['Code'] ?? '')), item);
        if (stmt) out.push(stmt);
      }
      return out;
    },
  };
}

function asString(v: string | number | undefined): string | undefined {
  return v === undefined || v === '' ? undefined : String(v);
}

export interface FetchMarketDataOptions {
  now: Date;
  historyDays?: number;
  log?: (line: string) => void;
}

// A date-based bulk fetch needs ~100 calls instead of one per stock and code (~8000).
// The most recent weekday can be a market holiday with no bars, so up to a week of earlier days is tried.
export async function fetchMarketData(client: JQuantsClient, opts: FetchMarketDataOptions): Promise<MarketData> {
  const log = opts.log ?? (() => undefined);
  const historyDays = opts.historyDays ?? DEFAULT_HISTORY_DAYS;
  const errors: string[] = [];

  const stocks = await client.listStocks();
  if (stocks.length === 0) throw new Error('[jquants] /equities/master returned 0 stocks; check the API key and plan');

  let priceDay = previousWeekday(new Date(opts.now.getTime() - FREE_TIER_LAG_DAYS * MS_PER_DAY));
  let prices = await client.fetchPrices(priceDay);
  for (let tries = 0; prices.size === 0 && tries < 5; tries++) {
    priceDay = previousWeekday(new Date(priceDay.getTime() - MS_PER_DAY));
    prices = await client.fetchPrices(priceDay);
  }
  if (prices.size === 0) throw new Error('[jquants] no daily bars found for the latest available weekdays');
  log(`prices: ${prices.size} codes on ${formatDate(priceDay)}`);

  const days: Date[] = [];
  for (let t = priceDay.getTime() - historyDays * MS_PER_DAY; t <= priceDay.getTime(); t += MS_PER_DAY) {
    const d = new Date(t);
    if (!isWeekend(d)) days.push(d);
  }

  const statements = new Map<string, StatementRaw[]>();
  let failedDays = 0;
  for (const day of days) {
    try {
      for (const stmt of await client.fetchStatementsOn(day)) {
        const list = statements.get(stmt.code);
        if (list) list.push(stmt);
        else statements.set(stmt.code, [stmt]);
      }
    } catch (e) {
      failedDays++;
      errors.push(`statements for ${formatDate(day)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failedDays > days.length * MAX_FAILED_STATEMENT_DAY_RATIO) {
    throw new Error(`[jquants] statements failed for ${failedDays} of ${days.length} days: ${errors[0]}`);
  }
  log(`statements: ${statements.size} codes over ${days.length} weekdays`);

  return { stocks, statements, prices, apiCalls: client.requestCount, errors };
}

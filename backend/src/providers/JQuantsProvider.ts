import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DataProvider, StockInfo, StatementRaw, PriceRaw } from './DataProvider.js';
import { config } from '../lib/config.js';

// NOTE: J-Quants Free tier data has a 12-week delay.
// All stock prices and financial statements fetched here are approximately
// 12 weeks (84 days) behind real-time. This is expected and acceptable
// for monthly/quarterly screening (清原流 investment cadence).

const JQUANTS_BASE = 'https://api.jquants.com';

// ---------------------------------------------------------------------------
// Token cache (stored on disk to survive process restarts)
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../../../.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'jquants-token.json');

/** 60-second buffer: treat token as expired this many seconds before actual expiry */
const EXPIRY_BUFFER_SEC = 60;

interface TokenCache {
  refreshToken: string;
  refreshTokenExpiresAt: string; // ISO 8601
  idToken: string;
  idTokenExpiresAt: string; // ISO 8601
}

function readCache(): TokenCache | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as TokenCache;
  } catch {
    return null;
  }
}

function writeCache(cache: TokenCache): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[jquants] failed to write token cache:', err);
  }
}

function isValid(expiresAt: string): boolean {
  const exp = new Date(expiresAt).getTime();
  return exp - EXPIRY_BUFFER_SEC * 1000 > Date.now();
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** Parse numeric string; return null for empty/NaN */
function parseNum(v: string | undefined | null): number | null {
  if (!v || v.trim() === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** Sleep helper for retry backoff */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Raw HTTP fetch with retry logic.
 * - 429 / 5xx: exponential backoff (1s, 2s, 4s), max 3 retries
 * - Other non-2xx: fail immediately
 * Does NOT inject auth header — used only for auth endpoints.
 */
async function fetchWithRetry(url: string, options: RequestInit, label?: string): Promise<Response> {
  const MAX_RETRIES = 3;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const res = await fetch(url, options);

    if (res.ok) return res;

    if (res.status === 429 || res.status >= 500) {
      if (attempt <= MAX_RETRIES) {
        const wait = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.error(`[jquants] rate limited or server error (${res.status}), retrying in ${wait / 1000}s (attempt ${attempt}/${MAX_RETRIES})${label ? ` [${label}]` : ''}`);
        await sleep(wait);
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
    }

    // Non-retryable error or exhausted retries
    const body = await res.text().catch(() => '');
    throw new Error(`[jquants] HTTP ${res.status} ${res.statusText}${label ? ` [${label}]` : ''}: ${body.slice(0, 200)}`);
  }

  throw lastErr ?? new Error('[jquants] request failed after retries');
}

// ---------------------------------------------------------------------------
// JQuantsProvider
// ---------------------------------------------------------------------------

export class JQuantsProvider implements DataProvider {
  readonly name = 'jquants';

  private idTokenCache: string | null = null;

  private ensureCredentials(): void {
    if (!config.jquants.mail || !config.jquants.password) {
      throw new Error(
        'J-Quants credentials not set. Register at https://jpx-jquants.com/ ' +
          'and set JQUANTS_MAIL_ADDRESS and JQUANTS_PASSWORD in backend/.env'
      );
    }
  }

  // -------------------------------------------------------------------------
  // Token management
  // -------------------------------------------------------------------------

  /**
   * Returns a valid idToken, refreshing or re-authenticating as needed.
   * Credentials are NEVER logged.
   */
  private async getIdToken(): Promise<string> {
    const cache = readCache();

    // 1. Cached idToken still valid
    if (cache && isValid(cache.idTokenExpiresAt)) {
      const hoursLeft = Math.round((new Date(cache.idTokenExpiresAt).getTime() - Date.now()) / 3_600_000);
      console.error(`[jquants] using cached idToken (expires in ${hoursLeft}h)`);
      return cache.idToken;
    }

    // 2. Cached refreshToken still valid — get new idToken
    if (cache && isValid(cache.refreshTokenExpiresAt)) {
      console.error('[jquants] refreshing idToken from cached refreshToken...');
      const idToken = await this.fetchIdToken(cache.refreshToken);
      writeCache({
        ...cache,
        idToken,
        idTokenExpiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      });
      console.error('[jquants] authenticated, idToken valid for 24h');
      return idToken;
    }

    // 3. Full re-authentication
    console.error('[jquants] authenticating...');
    const refreshToken = await this.fetchRefreshToken();
    const idToken = await this.fetchIdToken(refreshToken);
    writeCache({
      refreshToken,
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
      idToken,
      idTokenExpiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    });
    console.error('[jquants] authenticated, idToken valid for 24h');
    return idToken;
  }

  /** POST /v1/token/auth_user — returns refreshToken (valid 1 week) */
  private async fetchRefreshToken(): Promise<string> {
    const res = await fetchWithRetry(
      `${JQUANTS_BASE}/v1/token/auth_user`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Credentials deliberately not logged
        body: JSON.stringify({
          mailaddress: config.jquants.mail,
          password: config.jquants.password,
        }),
      },
      'auth_user'
    );
    const data = (await res.json()) as { refreshToken?: string };
    if (!data.refreshToken) throw new Error('[jquants] auth_user response missing refreshToken');
    return data.refreshToken;
  }

  /** POST /v1/token/auth_refresh — returns idToken (valid 24h) */
  private async fetchIdToken(refreshToken: string): Promise<string> {
    const res = await fetchWithRetry(
      `${JQUANTS_BASE}/v1/token/auth_refresh?refreshtoken=${encodeURIComponent(refreshToken)}`,
      { method: 'POST' },
      'auth_refresh'
    );
    const data = (await res.json()) as { idToken?: string };
    if (!data.idToken) throw new Error('[jquants] auth_refresh response missing idToken');
    return data.idToken;
  }

  // -------------------------------------------------------------------------
  // Authenticated request helper
  // -------------------------------------------------------------------------

  /**
   * Make an authenticated GET request to J-Quants API.
   * Handles rate-limit retry and pagination key chaining.
   */
  private async get<T>(path: string): Promise<T> {
    const idToken = await this.getIdToken();
    const url = path.startsWith('http') ? path : `${JQUANTS_BASE}${path}`;
    const res = await fetchWithRetry(
      url,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${idToken}` },
      },
      path
    );
    return res.json() as Promise<T>;
  }

  /**
   * Paginated GET: follows pagination_key until exhausted.
   * `extractItems` pulls the array out of each page's response object.
   * `pageKey` is the JSON key that holds items (e.g. "info", "statements").
   */
  private async getPaginated<TItem>(
    basePath: string,
    pageKey: string
  ): Promise<TItem[]> {
    const results: TItem[] = [];
    let path = basePath;

    for (;;) {
      const data = await this.get<Record<string, unknown>>(path);
      const items = data[pageKey] as TItem[] | undefined;
      if (items) results.push(...items);

      const paginationKey = data['pagination_key'] as string | undefined;
      if (!paginationKey) break;

      // Append pagination_key as query param
      const sep = basePath.includes('?') ? '&' : '?';
      path = `${basePath}${sep}pagination_key=${encodeURIComponent(paginationKey)}`;
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // DataProvider implementation
  // -------------------------------------------------------------------------

  /**
   * List all currently listed stocks.
   *
   * J-Quants Free tier: no date restriction needed for /v1/listed/info
   * (the endpoint returns the current listing status; no 12-week lag applies here).
   *
   * NOTE: Stock prices and financial data still have a 12-week lag.
   */
  async listStocks(): Promise<StockInfo[]> {
    this.ensureCredentials();

    type JQuantsInfo = {
      Code: string;
      CompanyName: string;
      CompanyNameEnglish: string;
      Sector17Code: string;
      Sector17CodeName: string;
      Sector33Code: string;
      Sector33CodeName: string;
      ScaleCategory: string;
      MarketCode: string;
      MarketCodeName: string;
    };

    const items = await this.getPaginated<JQuantsInfo>('/v1/listed/info', 'info');

    return items.map((item) => ({
      // J-Quants returns 5-digit codes with trailing 0 (e.g. "72030" for トヨタ 7203).
      // Our schema uses 4-digit codes — strip the trailing 0.
      code: item.Code.slice(0, 4),
      name: item.CompanyName,
      sector33Code: item.Sector33Code ?? null,
      sector33Name: item.Sector33CodeName ?? null,
      sector17Code: item.Sector17Code ?? null,
      marketSegment: item.MarketCodeName ?? null,
      scaleCategory: item.ScaleCategory ?? null,
      // sharesOutstanding is not available from /v1/listed/info;
      // it is populated per-statement in fetchStatements().
      sharesOutstanding: 0,
    }));
  }

  /**
   * Fetch financial statements for a given 4-digit stock code.
   *
   * NOTE: J-Quants Free tier provides financial data with a ~12-week lag.
   * The most recently disclosed statement visible may be 12 weeks old.
   */
  async fetchStatements(code: string): Promise<StatementRaw[]> {
    this.ensureCredentials();

    // J-Quants expects 5-digit codes (append trailing 0)
    const jqCode = `${code}0`;

    type JQuantsStatement = {
      DisclosedDate: string;
      DisclosedTime: string;
      LocalCode: string;
      TypeOfDocument: string;
      TypeOfCurrentPeriod: string;
      CurrentPeriodStartDate: string;
      CurrentPeriodEndDate: string;
      CurrentFiscalYearStartDate: string;
      CurrentFiscalYearEndDate: string;
      NetSales: string;
      OperatingProfit: string;
      OrdinaryProfit: string;
      Profit: string;
      EarningsPerShare: string;
      TotalAssets: string;
      Equity: string;
      CashAndEquivalents: string;
      NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock: string;
      NumberOfTreasuryStockAtTheEndOfFiscalYear: string;
      AverageNumberOfShares: string;
    };

    const items = await this.getPaginated<JQuantsStatement>(
      `/v1/fins/statements?code=${jqCode}`,
      'statements'
    );

    // Filter to actual financial statements (exclude dividend forecasts, etc.)
    const filtered = items.filter((item) =>
      item.TypeOfDocument.includes('FinancialStatements')
    );

    return filtered.map((item) => {
      const issued = parseNum(
        item.NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock
      );
      const treasury = parseNum(item.NumberOfTreasuryStockAtTheEndOfFiscalYear);
      const sharesOutstanding =
        issued !== null && treasury !== null ? issued - treasury : issued;

      return {
        code,
        fiscalYear: new Date(item.CurrentFiscalYearEndDate).getFullYear(),
        typeOfCurrentPeriod: item.TypeOfCurrentPeriod, // 'FY' | '1Q' | '2Q' | '3Q'
        disclosedDate: new Date(item.DisclosedDate),
        periodEndDate: new Date(item.CurrentPeriodEndDate),
        netSales: parseNum(item.NetSales),
        operatingProfit: parseNum(item.OperatingProfit),
        ordinaryProfit: parseNum(item.OrdinaryProfit),
        profit: parseNum(item.Profit),
        totalAssets: parseNum(item.TotalAssets),
        equity: parseNum(item.Equity),
        cashAndEquivalents: parseNum(item.CashAndEquivalents),
        sharesOutstanding,
      };
    });
  }

  /**
   * Fetch daily price quotes for a given 4-digit stock code.
   *
   * NOTE: J-Quants Free tier has a 12-week data lag.
   * We query from 20 weeks ago to today; the API will return data up to
   * the most recent available date (i.e., roughly 12 weeks ago).
   * The caller (syncOrchestrator) picks the latest close price.
   */
  async fetchPrices(code: string, opts?: { from?: Date; to?: Date }): Promise<PriceRaw[]> {
    this.ensureCredentials();

    // J-Quants expects 5-digit codes (append trailing 0)
    const jqCode = `${code}0`;

    const toDate = opts?.to ?? new Date();
    // Default: query 20 weeks back to ensure we capture data despite the 12-week Free tier lag
    const fromDate = opts?.from ?? new Date(toDate.getTime() - 20 * 7 * 24 * 3_600_000);

    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    const from = fmt(fromDate);
    const to = fmt(toDate);

    type JQuantsQuote = {
      Date: string;
      Code: string;
      Open: string;
      High: string;
      Low: string;
      Close: string;
      Volume: string;
      TurnoverValue: string;
    };

    const items = await this.getPaginated<JQuantsQuote>(
      `/v1/prices/daily_quotes?code=${jqCode}&from=${from}&to=${to}`,
      'daily_quotes'
    );

    return items.map((item) => ({
      code,
      date: new Date(item.Date),
      close: parseFloat(item.Close),
    }));
  }
}

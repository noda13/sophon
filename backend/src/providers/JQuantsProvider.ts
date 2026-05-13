import type { DataProvider, StockInfo, StatementRaw, PriceRaw } from './DataProvider.js';
import { config } from '../lib/config.js';

// NOTE: J-Quants Free tier data has a 12-week delay.
// All stock prices and financial statements fetched here are approximately
// 12 weeks (84 days) behind real-time. This is expected and acceptable
// for monthly/quarterly screening (清原流 investment cadence).

// J-Quants V2 API (released 2025-12-22)
// Auth: x-api-key header (NO Bearer, NO Authorization)
// Base URL: https://api.jquants.com/v2
// Response wrapper: { "data": [...], "pagination_key": "..." }

const JQUANTS_BASE_V2 = 'https://api.jquants.com/v2';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** Parse numeric string; return null for empty/NaN */
function parseNum(v: string | number | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (v.trim() === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** Sleep helper for retry backoff */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Adaptive rate limiter tuned for J-Quants tier limits (official docs):
//   Free:     5 req/min   = 1 req per 12s  → use 13s interval (+1s safety)
//   Light:    60 req/min  = 1 req per 1s   → use 1.1s interval
//   Standard: 120 req/min = 1 req per 0.5s → use 0.6s interval
//
// Policy doc also warns: "significantly exceeding the limit may block access
// for approximately 5 minutes." So we are careful never to burst.
//
// JQUANTS_REQ_INTERVAL_MS can override (for Light/Standard tier users).
// Default assumes Free tier.
const NORMAL_INTERVAL_MS = parseInt(process.env.JQUANTS_REQ_INTERVAL_MS ?? '13000', 10);
const SLOW_INTERVAL_MS = Math.max(NORMAL_INTERVAL_MS * 2, 20000); // double on 429
const SLOW_DURATION_MS = 10 * 60 * 1000; // 10 min cooldown after 429
const CONSECUTIVE_OK_TO_SPEEDUP = 30;

function normalizeCode(rawCode: string): string {
  return rawCode.slice(0, 4);
}

// ---------------------------------------------------------------------------
// JQuantsProvider (V2)
// ---------------------------------------------------------------------------

export class JQuantsProvider implements DataProvider {
  readonly name = 'jquants';

  // In-memory caches populated by prefetchAll().
  // Keys are 4-digit codes. Values are arrays of raw records.
  private statementCache: Map<string, StatementRaw[]> = new Map();
  private priceCache: Map<string, PriceRaw[]> = new Map();
  private prefetched = false;

  // Rate limiter state (moved from module level)
  private lastRequestAt = 0;
  private slowModeUntil = 0;
  private consecutiveOk = 0;
  private pacingChain: Promise<void> = Promise.resolve();

  private currentInterval(): number {
    return Date.now() < this.slowModeUntil ? SLOW_INTERVAL_MS : NORMAL_INTERVAL_MS;
  }

  private throttle(): Promise<void> {
    const next = this.pacingChain.then(async () => {
      const interval = this.currentInterval();
      const waitMs = interval - (Date.now() - this.lastRequestAt);
      if (waitMs > 0) await sleep(waitMs);
      this.lastRequestAt = Date.now();
    });
    this.pacingChain = next.catch(() => undefined);
    return next;
  }

  private noteRateLimit(): void {
    this.consecutiveOk = 0;
    const until = Date.now() + SLOW_DURATION_MS;
    if (until > this.slowModeUntil) {
      this.slowModeUntil = until;
      console.error(
        `[jquants] entering slow mode (${SLOW_INTERVAL_MS}ms interval) for ${SLOW_DURATION_MS / 1000}s`
      );
    }
  }

  private noteSuccess(): void {
    this.consecutiveOk++;
    if (this.consecutiveOk >= CONSECUTIVE_OK_TO_SPEEDUP && Date.now() < this.slowModeUntil) {
      this.slowModeUntil = 0;
      console.error('[jquants] resuming normal pace after sustained successes');
    }
  }

  /**
   * Raw HTTP fetch with retry logic (V2 version).
   * - Pre-request throttle: min 600ms interval between requests
   * - 429: exponential backoff (10s, 30s, 60s), max 3 retries
   * - 5xx: exponential backoff (2s, 4s, 8s), max 3 retries
   * - Other non-2xx: fail immediately
   * Injects x-api-key header automatically.
   */
  private async fetchV2(
    path: string,
    queryParams?: Record<string, string>,
    label?: string
  ): Promise<unknown> {
    const MAX_RETRIES = 3;
    let lastErr: Error | null = null;

    const url = new URL(`${JQUANTS_BASE_V2}${path}`);
    if (queryParams) {
      for (const [k, v] of Object.entries(queryParams)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      'x-api-key': config.jquants.apiKey,
    };

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      await this.throttle();
      const res = await fetch(url.toString(), { method: 'GET', headers });

      if (res.ok) {
        this.noteSuccess();
        return res.json();
      }

      if (res.status === 429 || res.status >= 500) {
        if (res.status === 429) this.noteRateLimit();

        if (attempt <= MAX_RETRIES) {
          // 429: long patient waits (10s, 30s, 60s) — slow mode is also active
          // 5xx: shorter waits (2s, 4s, 8s)
          const wait =
            res.status === 429
              ? [10_000, 30_000, 60_000][attempt - 1]
              : [2_000, 4_000, 8_000][attempt - 1];
          console.error(
            `[jquants] ${res.status} ${label ? `[${label}] ` : ''}retrying in ${wait / 1000}s (attempt ${attempt}/${MAX_RETRIES})`
          );
          await sleep(wait);
          lastErr = new Error(`HTTP ${res.status}`);
          continue;
        }
      }

      // Non-retryable error or exhausted retries
      const body = await res.text().catch(() => '');
      throw new Error(
        `[jquants] HTTP ${res.status} ${res.statusText}${label ? ` [${label}]` : ''}: ${body.slice(0, 200)}`
      );
    }

    throw lastErr ?? new Error('[jquants] request failed after retries');
  }

  /**
   * Paginated GET for V2.
   * V2 always wraps items in `{ "data": [...], "pagination_key": "..." }`.
   * Loops until no pagination_key, concatenating all data arrays.
   */
  private async getPaginated<TItem>(
    path: string,
    queryParams?: Record<string, string>
  ): Promise<TItem[]> {
    const results: TItem[] = [];
    const params: Record<string, string> = { ...(queryParams ?? {}) };

    for (;;) {
      const response = (await this.fetchV2(path, params, path)) as Record<string, unknown>;

      const items = response['data'] as TItem[] | undefined;
      if (items && Array.isArray(items)) {
        results.push(...items);
      }

      const paginationKey = response['pagination_key'] as string | undefined;
      if (!paginationKey) break;

      params['pagination_key'] = paginationKey;
    }

    return results;
  }

  private ensureApiKey(): void {
    if (!config.jquants.apiKey) {
      throw new Error(
        'J-Quants API key not set. Register at https://jpx-jquants.com/ ' +
          'and set JQUANTS_API_KEY in backend/.env\n' +
          '(V2 API, released 2025-12-22, uses API key instead of mail+password)'
      );
    }
  }

  /**
   * Pre-load bulk data using J-Quants V2 date-based batch endpoints.
   * Dramatically reduces API calls: ~60-120 calls vs ~8000 for per-code sync.
   *
   * Strategy:
   *   1. Call /v2/equities/bars/daily?date=<latest-available> ONCE (gets all stocks' prices)
   *   2. Iterate weekdays over historyDays window, calling /v2/fins/summary?date=YYYYMMDD per day
   *      (each call returns 0-200 disclosures, aggregate across codes)
   *   3. Store in statementCache / priceCache keyed by 4-digit code
   *
   * After this, fetchStatements(code) and fetchPrices(code) read from cache
   * without hitting the API.
   */
  async prefetchAll(opts?: { historyDays?: number }): Promise<{
    statementsCached: number;
    pricesCached: number;
    apiCalls: number;
  }> {
    this.ensureApiKey();

    const historyDays = opts?.historyDays ?? 120;
    const MS_PER_DAY = 24 * 3_600_000;
    const FREE_TIER_LAG_DAYS = 84; // 12 weeks
    const freeTierCeil = new Date(Date.now() - FREE_TIER_LAG_DAYS * MS_PER_DAY);

    // Walk back to nearest weekday (Mon–Fri)
    const latestTradingDay = new Date(freeTierCeil);
    while (latestTradingDay.getDay() === 0 || latestTradingDay.getDay() === 6) {
      latestTradingDay.setTime(latestTradingDay.getTime() - MS_PER_DAY);
    }

    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    let apiCalls = 0;

    // --- 1. Fetch all prices for the latest available trading day (1 API call) ---
    console.error(`[jquants] prefetch: prices for ${fmt(latestTradingDay)} (all stocks, 1 API call)`);
    type JQuantsBar = Record<string, string | number | undefined>;
    const priceItems = await this.getPaginated<JQuantsBar>('/equities/bars/daily', {
      date: fmt(latestTradingDay),
    });
    apiCalls++;
    for (const item of priceItems) {
      const code = normalizeCode(String(item['Code'] ?? ''));
      const closeRaw = item['C'] ?? item['Close'];
      const close = parseNum(closeRaw as string | number | undefined);
      const dateStr = item['Date'] as string | undefined;
      if (!close || !dateStr) continue;
      const priceRaw: PriceRaw = {
        code,
        date: new Date(dateStr),
        close,
      };
      const arr = this.priceCache.get(code) ?? [];
      arr.push(priceRaw);
      this.priceCache.set(code, arr);
    }
    console.error(`[jquants] prefetch: got ${priceItems.length} prices for ${this.priceCache.size} unique codes`);

    // --- 2. Fetch statements for each weekday in the history window ---
    const fromDate = new Date(latestTradingDay.getTime() - historyDays * MS_PER_DAY);
    const tradingDays: Date[] = [];
    for (
      let d = new Date(fromDate);
      d.getTime() <= latestTradingDay.getTime();
      d = new Date(d.getTime() + MS_PER_DAY)
    ) {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        tradingDays.push(new Date(d));
      }
    }

    console.error(
      `[jquants] prefetch: statements over ${tradingDays.length} weekdays (${fmt(fromDate)} → ${fmt(latestTradingDay)})`
    );

    type JQuantsSummary = Record<string, string | number | undefined>;
    let totalStatements = 0;
    for (const [idx, day] of tradingDays.entries()) {
      const items = await this.getPaginated<JQuantsSummary>('/fins/summary', { date: fmt(day) });
      apiCalls++;
      for (const item of items) {
        const code = normalizeCode(String(item['Code'] ?? ''));

        const docType =
          (item['DocType'] as string | undefined) ??
          (item['TypeOfDocument'] as string | undefined) ??
          '';
        if (!docType.includes('FinancialStatements')) continue;

        const issued = parseNum(
          (item['ShOutFY'] ??
            item['NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock']) as
            | string
            | undefined
        );
        const treasury = parseNum(
          (item['TrShFY'] ?? item['NumberOfTreasuryStockAtTheEndOfFiscalYear']) as
            | string
            | undefined
        );
        const sharesOutstanding =
          issued !== null && treasury !== null ? issued - treasury : issued;

        const disclosedDate = (item['DiscDate'] ?? item['DisclosedDate']) as string | undefined;
        const periodEndDate = (item['CurPerEn'] ?? item['CurrentPeriodEndDate']) as
          | string
          | undefined;
        const typeOfPeriod = (item['CurPerType'] ?? item['TypeOfCurrentPeriod']) as
          | string
          | undefined;

        const stmt: StatementRaw = {
          code,
          fiscalYear: periodEndDate ? new Date(periodEndDate).getFullYear() : 0,
          typeOfCurrentPeriod: typeOfPeriod ?? '',
          disclosedDate: disclosedDate ? new Date(disclosedDate) : new Date(0),
          periodEndDate: periodEndDate ? new Date(periodEndDate) : new Date(0),
          netSales: parseNum((item['Sales'] ?? item['NetSales']) as string | undefined),
          operatingProfit: parseNum(
            (item['OP'] ?? item['OperatingProfit']) as string | undefined
          ),
          ordinaryProfit: parseNum(
            (item['OdP'] ?? item['OrdinaryProfit']) as string | undefined
          ),
          profit: parseNum((item['NP'] ?? item['Profit']) as string | undefined),
          totalAssets: parseNum((item['TA'] ?? item['TotalAssets']) as string | undefined),
          equity: parseNum((item['Eq'] ?? item['Equity']) as string | undefined),
          currentAssets: parseNum((item['CA'] ?? item['CurrentAssets']) as string | undefined),
          cashAndEquivalents: parseNum(
            (item['CashEq'] ?? item['CashAndEquivalents']) as string | undefined
          ),
          sharesOutstanding,
        };
        const arr = this.statementCache.get(code) ?? [];
        arr.push(stmt);
        this.statementCache.set(code, arr);
        totalStatements++;
      }

      // Progress every 20 days
      if ((idx + 1) % 20 === 0 || idx === tradingDays.length - 1) {
        console.error(
          `[jquants] prefetch: ${idx + 1}/${tradingDays.length} days done, ${totalStatements} statements, ${this.statementCache.size} unique codes`
        );
      }
    }

    this.prefetched = true;
    return {
      statementsCached: totalStatements,
      pricesCached: priceItems.length,
      apiCalls,
    };
  }

  // -------------------------------------------------------------------------
  // DataProvider implementation
  // -------------------------------------------------------------------------

  /**
   * List all currently listed stocks.
   * V2 endpoint: GET /v2/equities/master
   *
   * NOTE: Stock prices and financial data have a 12-week lag (Free tier).
   */
  async listStocks(): Promise<StockInfo[]> {
    this.ensureApiKey();

    // V2 field names believed to match V1 capitalized names.
    // Using tolerant access in case any field differs.
    type JQuantsMaster = Record<string, string | undefined>;

    const items = await this.getPaginated<JQuantsMaster>('/equities/master');

    if (items.length === 0) {
      console.warn('[jquants] /equities/master returned 0 items — check API key and plan');
    } else {
      // Warn if expected fields are missing (first item check)
      const first = items[0];
      if (!first['Code']) {
        console.warn('[jquants] /equities/master: "Code" field missing from first item. Keys:', Object.keys(first));
      }
    }

    return items.map((item) => {
      // J-Quants returns 5-digit codes (e.g. "72030" for トヨタ 7203, "13010" for 極洋 1301).
      // Our schema uses 4-digit codes — strip the trailing 0.
      const code = normalizeCode(item['Code'] ?? '');

      // V2 field names are abbreviated: CoName, S33, S33Nm, S17, Mkt, MktNm, ScaleCat
      // Keep V1 full names as fallback for safety
      return {
        code,
        name: item['CoName'] ?? item['CompanyName'] ?? item['Name'] ?? '',
        sector33Code: item['S33'] ?? item['Sector33Code'] ?? undefined,
        sector33Name: item['S33Nm'] ?? item['Sector33CodeName'] ?? undefined,
        sector17Code: item['S17'] ?? item['Sector17Code'] ?? undefined,
        marketSegment:
          item['MktNm'] ?? item['MarketCodeName'] ?? item['MarketSegment'] ?? undefined,
        scaleCategory: item['ScaleCat'] ?? item['ScaleCategory'] ?? undefined,
        // sharesOutstanding is not available from /equities/master;
        // it is populated per-statement in fetchStatements().
        sharesOutstanding: 0,
      };
    });
  }

  /**
   * Fetch financial statements for a given 4-digit stock code.
   * V2 endpoint: GET /v2/fins/summary?code={code}0
   *
   * NOTE: J-Quants Free tier provides financial data with a ~12-week lag.
   */
  async fetchStatements(code: string): Promise<StatementRaw[]> {
    this.ensureApiKey();

    // If prefetchAll() was called, serve from cache without any API request.
    if (this.prefetched) {
      return this.statementCache.get(code) ?? [];
    }

    // J-Quants expects 5-digit codes (append trailing 0)
    const jqCode = `${code}0`;

    type JQuantsSummary = Record<string, string | number | undefined>;

    const items = await this.getPaginated<JQuantsSummary>('/fins/summary', { code: jqCode });

    // V2 field name: DocType (V1 was TypeOfDocument)
    // Filter to actual financial statements (exclude dividend forecasts, etc.)
    const filtered = items.filter((item) => {
      const tod =
        (item['DocType'] as string | undefined) ??
        (item['TypeOfDocument'] as string | undefined) ??
        '';
      return tod.includes('FinancialStatements');
    });

    if (items.length > 0 && filtered.length === 0) {
      console.warn(
        `[jquants] /fins/summary code=${jqCode}: ${items.length} items returned but none matched DocType.includes("FinancialStatements"). ` +
          `Sample DocType values: ${items
            .slice(0, 3)
            .map((i) => i['DocType'] ?? i['TypeOfDocument'])
            .join(', ')}`
      );
    }

    return filtered.map((item) => {
      // V2 field names: ShOutFY (issued), TrShFY (treasury)
      const issued = parseNum(
        (item['ShOutFY'] ??
          item['NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock']) as
          | string
          | undefined
      );
      const treasury = parseNum(
        (item['TrShFY'] ?? item['NumberOfTreasuryStockAtTheEndOfFiscalYear']) as string | undefined
      );
      const sharesOutstanding =
        issued !== null && treasury !== null ? issued - treasury : issued;

      // V2 field names: DiscDate, CurPerEn, CurPerType
      const disclosedDate = (item['DiscDate'] ?? item['DisclosedDate']) as string | undefined;
      const periodEndDate = (item['CurPerEn'] ?? item['CurrentPeriodEndDate']) as
        | string
        | undefined;
      const typeOfPeriod = (item['CurPerType'] ?? item['TypeOfCurrentPeriod']) as
        | string
        | undefined;

      return {
        code,
        fiscalYear: periodEndDate ? new Date(periodEndDate).getFullYear() : 0,
        typeOfCurrentPeriod: typeOfPeriod ?? '',
        disclosedDate: disclosedDate ? new Date(disclosedDate) : new Date(0),
        periodEndDate: periodEndDate ? new Date(periodEndDate) : new Date(0),
        // V2 field names: Sales, OP, OdP, NP (NetProfit), TA, Eq, CashEq
        netSales: parseNum((item['Sales'] ?? item['NetSales']) as string | undefined),
        operatingProfit: parseNum((item['OP'] ?? item['OperatingProfit']) as string | undefined),
        ordinaryProfit: parseNum((item['OdP'] ?? item['OrdinaryProfit']) as string | undefined),
        profit: parseNum((item['NP'] ?? item['Profit']) as string | undefined),
        totalAssets: parseNum((item['TA'] ?? item['TotalAssets']) as string | undefined),
        equity: parseNum((item['Eq'] ?? item['Equity']) as string | undefined),
        currentAssets: parseNum((item['CA'] ?? item['CurrentAssets']) as string | undefined),
        cashAndEquivalents: parseNum(
          (item['CashEq'] ?? item['CashAndEquivalents']) as string | undefined
        ),
        sharesOutstanding,
      };
    });
  }

  /**
   * Fetch daily price quotes for a given 4-digit stock code.
   * V2 endpoint: GET /v2/equities/bars/daily?code={code}0&from=...&to=...
   *
   * V2 uses abbreviated field names: O/H/L/C/Vo instead of Open/High/Low/Close/Volume.
   * We use tolerant fallback: item.C ?? item.Close
   *
   * NOTE: J-Quants Free tier has a 12-week data lag.
   */
  async fetchPrices(code: string, opts?: { from?: Date; to?: Date }): Promise<PriceRaw[]> {
    this.ensureApiKey();

    // If prefetchAll() was called, serve from cache without any API request.
    if (this.prefetched) {
      return this.priceCache.get(code) ?? [];
    }

    // J-Quants expects 5-digit codes (append trailing 0)
    const jqCode = `${code}0`;

    // J-Quants Free tier subscription window: from ~2 years ago to ~12 weeks before today.
    // Requesting beyond (today-12w) returns HTTP 400 with a plan-upgrade message.
    // Cap `to` at today - 12 weeks (84 days) to stay inside the subscription window.
    const MS_PER_DAY = 24 * 3_600_000;
    const FREE_TIER_LAG_DAYS = 84; // 12 weeks
    const freeTierCeil = new Date(Date.now() - FREE_TIER_LAG_DAYS * MS_PER_DAY);

    let toDate = opts?.to ?? freeTierCeil;
    if (toDate > freeTierCeil) toDate = freeTierCeil;
    // Default: query 4 weeks before `toDate` to get ~20 trading days around the ceiling
    const fromDate = opts?.from ?? new Date(toDate.getTime() - 4 * 7 * MS_PER_DAY);

    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    const from = fmt(fromDate);
    const to = fmt(toDate);

    // V2 uses abbreviated field names: O/H/L/C/Vo
    // Tolerant: try abbreviated first, fall back to full names (in case V2 changes)
    type JQuantsBar = Record<string, string | number | undefined>;

    const items = await this.getPaginated<JQuantsBar>('/equities/bars/daily', {
      code: jqCode,
      from,
      to,
    });

    if (items.length > 0) {
      const first = items[0];
      // Detect if abbreviated or full field names are in use
      const hasAbbrev = first['C'] !== undefined;
      const hasFull = first['Close'] !== undefined;
      if (!hasAbbrev && !hasFull) {
        console.warn(
          `[jquants] /equities/bars/daily code=${jqCode}: neither "C" nor "Close" found. ` +
            `Keys in first item: ${Object.keys(first).join(', ')}`
        );
      }
    }

    // Map then filter: skip entries where close is null (holidays, trading halts, etc.)
    const mapped = items.map((item) => {
      // V2 abbreviation: C (close), fallback to Close
      const closeRaw = item['C'] ?? item['Close'];
      const close = parseNum(closeRaw as string | number | undefined);

      const dateStr = item['Date'] as string | undefined;

      return {
        code,
        date: dateStr ? new Date(dateStr) : new Date(0),
        close,
      };
    });

    return mapped
      .filter((p): p is PriceRaw & { close: number } => p.close !== null && !isNaN(p.close))
      .map((p) => ({ code: p.code, date: p.date, close: p.close }));
  }
}

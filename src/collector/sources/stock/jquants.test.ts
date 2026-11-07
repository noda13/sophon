import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createJQuantsClient, fetchMarketData, JQuantsHttpError } from './jquants';

const BASE = 'https://jquants.test/v2';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = (over: Partial<Parameters<typeof createJQuantsClient>[0]> = {}) =>
  createJQuantsClient({
    apiKey: 'test-key',
    baseUrl: BASE,
    requestIntervalMs: 0,
    rateLimitDelaysMs: [1, 1, 1],
    serverErrorDelaysMs: [1, 1, 1],
    ...over,
  });

describe('listStocks', () => {
  it('maps master rows, follows pagination and sends the api key', async () => {
    const seen: Array<{ key: string | null; pagination: string | null }> = [];
    server.use(
      http.get(`${BASE}/equities/master`, ({ request }) => {
        const url = new URL(request.url);
        const pagination = url.searchParams.get('pagination_key');
        seen.push({ key: request.headers.get('x-api-key'), pagination });
        return pagination
          ? HttpResponse.json({ data: [{ Code: '13010', CoName: 'Kyokuyo' }] })
          : HttpResponse.json({
              data: [{ Code: '72030', CoName: 'Toyota', S33: '3700', S33Nm: '輸送用機器', MktNm: 'プライム' }],
              pagination_key: 'k1',
            });
      }),
    );

    const stocks = await client().listStocks();

    expect(stocks.map((s) => [s.code, s.name])).toEqual([
      ['7203', 'Toyota'],
      ['1301', 'Kyokuyo'],
    ]);
    expect(stocks[0]?.sector33Name).toBe('輸送用機器');
    expect(stocks[0]?.marketSegment).toBe('プライム');
    expect(seen).toEqual([
      { key: 'test-key', pagination: null },
      { key: 'test-key', pagination: 'k1' },
    ]);
  });

  it('retries 429 then succeeds', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/equities/master`, () => {
        calls++;
        return calls === 1
          ? new HttpResponse('', { status: 429, headers: { 'retry-after': '0' } })
          : HttpResponse.json({ data: [{ Code: '72030', CoName: 'Toyota' }] });
      }),
    );

    expect(await client().listStocks()).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it('gives up after exhausting retries on 429', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/equities/master`, () => {
        calls++;
        return new HttpResponse('slow down', { status: 429 });
      }),
    );

    await expect(client().listStocks()).rejects.toThrow(/HTTP 429/);
    expect(calls).toBe(4);
  });

  it('retries 5xx', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/equities/master`, () => {
        calls++;
        return calls === 1 ? new HttpResponse('', { status: 503 }) : HttpResponse.json({ data: [] });
      }),
    );

    await client().listStocks();
    expect(calls).toBe(2);
  });

  it('does not retry other 4xx', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/equities/master`, () => {
        calls++;
        return new HttpResponse('bad key', { status: 403 });
      }),
    );

    const error = await client().listStocks().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JQuantsHttpError);
    expect((error as JQuantsHttpError).status).toBe(403);
    expect(calls).toBe(1);
  });

  it('aborts a request that exceeds the timeout', async () => {
    server.use(
      http.get(`${BASE}/equities/master`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({ data: [] });
      }),
    );

    await expect(client({ timeoutMs: 20, rateLimitDelaysMs: [1], serverErrorDelaysMs: [1] }).listStocks()).rejects.toThrow();
  });
});

describe('fetchPrices and fetchStatementsOn', () => {
  it('keeps one close per code and skips rows without a close', async () => {
    server.use(
      http.get(`${BASE}/equities/bars/daily`, () =>
        HttpResponse.json({
          data: [
            { Code: '72030', Date: '2026-01-05', C: 2500.5 },
            { Code: '13010', Date: '2026-01-05', C: null },
            { Code: '13050', Date: '2026-01-05', Close: '1800' },
          ],
        }),
      ),
    );

    const prices = await client().fetchPrices(new Date('2026-01-05T00:00:00Z'));

    expect([...prices.keys()]).toEqual(['7203', '1305']);
    expect(prices.get('7203')?.close).toBe(2500.5);
    expect(prices.get('1305')?.close).toBe(1800);
  });

  it('keeps financial statements only and derives shares outstanding net of treasury stock', async () => {
    server.use(
      http.get(`${BASE}/fins/summary`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('date')).toBe('20260105');
        return HttpResponse.json({
          data: [
            {
              Code: '72030',
              DocType: 'FYFinancialStatements_Consolidated_JP',
              DiscDate: '2026-01-05',
              CurPerEn: '2025-12-31',
              CurPerType: 'FY',
              Sales: '1000',
              NP: '100',
              TA: '500',
              Eq: '300',
              CA: '400',
              ShOutFY: '1000',
              TrShFY: '100',
            },
            { Code: '72030', DocType: 'DividendForecastRevision', DiscDate: '2026-01-05' },
          ],
        });
      }),
    );

    const stmts = await client().fetchStatementsOn(new Date('2026-01-05T00:00:00Z'));

    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toMatchObject({
      code: '7203',
      fiscalYear: 2025,
      typeOfCurrentPeriod: 'FY',
      netSales: 1000,
      profit: 100,
      currentAssets: 400,
      sharesOutstanding: 900,
    });
    expect(stmts[0]?.cashAndEquivalents).toBeNull();
  });
});

describe('fetchMarketData', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const bars = (date: string) => HttpResponse.json({ data: [{ Code: '72030', Date: date, C: 100 }] });

  it('falls back to an earlier weekday when the latest has no bars', async () => {
    const requested: string[] = [];
    server.use(
      http.get(`${BASE}/equities/master`, () => HttpResponse.json({ data: [{ Code: '72030', CoName: 'Toyota' }] })),
      http.get(`${BASE}/equities/bars/daily`, ({ request }) => {
        const date = new URL(request.url).searchParams.get('date') ?? '';
        requested.push(date);
        return requested.length === 1 ? HttpResponse.json({ data: [] }) : bars('2026-03-06');
      }),
      http.get(`${BASE}/fins/summary`, () => HttpResponse.json({ data: [] })),
    );

    const data = await fetchMarketData(client(), { now, historyDays: 3 });

    // 2026-06-01 minus 84 days is Monday 2026-03-09; the next attempt is the previous weekday.
    expect(requested).toEqual(['20260309', '20260306']);
    expect(data.prices.get('7203')?.close).toBe(100);
    expect(data.stocks).toHaveLength(1);
  });

  it('tolerates a few failed statement days but throws when too many fail', async () => {
    server.use(
      http.get(`${BASE}/equities/master`, () => HttpResponse.json({ data: [{ Code: '72030', CoName: 'Toyota' }] })),
      http.get(`${BASE}/equities/bars/daily`, () => bars('2026-03-09')),
    );

    let failEvery = 20;
    let n = 0;
    server.use(
      http.get(`${BASE}/fins/summary`, () => {
        n++;
        return n % failEvery === 0 ? new HttpResponse('nope', { status: 400 }) : HttpResponse.json({ data: [] });
      }),
    );
    const ok = await fetchMarketData(client(), { now, historyDays: 60 });
    expect(ok.errors).toHaveLength(Math.floor(n / failEvery));
    expect(ok.errors.length).toBeGreaterThan(0);

    failEvery = 2;
    n = 0;
    await expect(fetchMarketData(client(), { now, historyDays: 60 })).rejects.toThrow(/statements failed/);
  });

  it('throws when the master list is empty', async () => {
    server.use(http.get(`${BASE}/equities/master`, () => HttpResponse.json({ data: [] })));
    await expect(fetchMarketData(client(), { now })).rejects.toThrow(/0 stocks/);
  });
});

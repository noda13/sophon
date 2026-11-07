import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RankingFileSchema, StockDetailSchema, StocksFileSchema } from '../../../shared/schema/stock';
import { removeStaleDetails, run } from './run';

const BASE = 'https://api.jquants.com/v2';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stock-run-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

const ctx = (env: NodeJS.ProcessEnv, signal?: AbortSignal) => ({ dir, now: new Date('2026-06-01T00:00:00Z'), env, signal });
const env = { JQUANTS_API_KEY: 'k', JQUANTS_REQ_INTERVAL_MS: '0' };
const readJson = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf-8'));

function mockApi() {
  server.use(
    http.get(`${BASE}/equities/master`, () =>
      HttpResponse.json({
        data: [
          { Code: '13010', CoName: '極洋', S33: '0050', S33Nm: '水産・農林業', S17: '1', MktNm: 'プライム', ScaleCat: 'TOPIX Small 1' },
          { Code: '72030', CoName: 'トヨタ', S33Nm: '輸送用機器', MktNm: 'プライム' },
          { Code: '99990', CoName: '財務なし', MktNm: 'グロース' },
          { Code: '../../x0', CoName: 'bad code' },
        ],
      }),
    ),
    http.get(`${BASE}/equities/bars/daily`, () =>
      HttpResponse.json({
        data: [
          { Code: '13010', Date: '2026-03-09', C: 1000 },
          { Code: '72030', Date: '2026-03-09', C: 2000 },
          { Code: '99990', Date: '2026-03-09', C: 500 },
        ],
      }),
    ),
    http.get(`${BASE}/fins/summary`, ({ request }) => {
      const date = new URL(request.url).searchParams.get('date');
      if (date !== '20260227') return HttpResponse.json({ data: [] });
      const base = { DocType: 'FYFinancialStatements_Consolidated_JP', DiscDate: '2026-02-27', CurPerEn: '2025-12-31', CurPerType: 'FY', ShOutFY: '1000000' };
      return HttpResponse.json({
        data: [
          { ...base, Code: '13010', Sales: '5000', NP: '100000000', TA: '2000000000', Eq: '900000000', CA: '1500000000' },
          { ...base, Code: '72030', Sales: '9000', NP: '500000000', TA: '9000000000', Eq: '5000000000', CA: '3000000000' },
        ],
      });
    }),
  );
}

describe('stock source run', () => {
  it('leaves previous data untouched and reports an error when the API key is missing', async () => {
    writeFileSync(join(dir, 'stocks.json'), '["previous"]');

    const result = await run(ctx({}));

    expect(result.counts).toMatchObject({ stocks: 0, rankings: 0, details: 0 });
    expect(result.errors.join()).toMatch(/JQUANTS_API_KEY/);
    expect(readFileSync(join(dir, 'stocks.json'), 'utf-8')).toBe('["previous"]');
  });

  it('writes strategies, stocks, six rankings and per-stock details that match the schemas', async () => {
    mockApi();
    mkdirSync(join(dir, 'stocks'));
    writeFileSync(join(dir, 'stocks', '0000.json'), '{}');

    const result = await run(ctx({ JQUANTS_API_KEY: 'k', JQUANTS_REQ_INTERVAL_MS: '0' }));

    expect(result.errors).toEqual([]);
    expect(result.counts).toMatchObject({ stocks: 2, rankings: 6, details: 3 });

    const stocks = StocksFileSchema.parse(readJson('stocks.json'));
    expect(stocks.map((s) => s.code).sort()).toEqual(['1301', '7203']);
    expect(stocks.find((s) => s.code === '1301')).toMatchObject({
      sector33Name: '水産・農林業',
      marketCap: 1_000_000_000,
      netCash: 1_500_000_000 - (2_000_000_000 - 900_000_000),
    });

    for (const id of ['kiyohara', 'graham', 'buffett', 'lynch', 'dividend', 'composite']) {
      const rows = RankingFileSchema.parse(readJson(`ranking-${id}.json`));
      expect(rows[0]?.rank).toBe(1);
      expect(rows[0]?.snapshotAt).toBe('2026-06-01T00:00:00.000Z');
    }

    const detail = StockDetailSchema.parse(readJson('stocks/1301.json'));
    expect(detail.history).toHaveLength(1);
    expect(Object.keys(detail.strategies).sort()).toEqual(['buffett', 'composite', 'dividend', 'graham', 'kiyohara', 'lynch']);
    expect(StockDetailSchema.parse(readJson('stocks/9999.json')).strategies).toEqual({});

    expect(readdirSync(join(dir, 'stocks')).sort()).toEqual(['1301.json', '7203.json', '9999.json']);
    expect(existsSync(join(dir, 'meta.json'))).toBe(false);
  });

  it('does not write anything when no stock has both a statement and a price', async () => {
    server.use(
      http.get(`${BASE}/equities/master`, () => HttpResponse.json({ data: [{ Code: '13010', CoName: '極洋' }] })),
      http.get(`${BASE}/equities/bars/daily`, () => HttpResponse.json({ data: [{ Code: '13010', Date: '2026-03-09', C: 1000 }] })),
      http.get(`${BASE}/fins/summary`, () => HttpResponse.json({ data: [] })),
    );

    const result = await run(ctx({ JQUANTS_API_KEY: 'k', JQUANTS_REQ_INTERVAL_MS: '0' }));

    expect(result.counts.stocks).toBe(0);
    expect(result.errors.join()).toMatch(/left unchanged/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('writes the data and reports the failed day when under 10% of days fail', async () => {
    mockApi();
    // Returning nothing falls through to the mockApi handler for every other date.
    server.use(
      http.get(`${BASE}/fins/summary`, ({ request }) =>
        new URL(request.url).searchParams.get('date') === '20260105' ? new HttpResponse('nope', { status: 400 }) : undefined,
      ),
    );

    const result = await run(ctx(env));

    expect(result.counts).toMatchObject({ stocks: 2, details: 3 });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/statements for 20260105: .*HTTP 400/);
    expect(StocksFileSchema.parse(readJson('stocks.json'))).toHaveLength(2);
  });

  it('writes nothing when too many statement days fail', async () => {
    mockApi();
    let n = 0;
    server.use(http.get(`${BASE}/fins/summary`, () => (++n % 2 === 0 ? new HttpResponse('nope', { status: 400 }) : undefined)));

    await expect(run(ctx(env))).rejects.toThrow(/statements failed/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('rejects without writing when the signal is already aborted', async () => {
    mockApi();
    const controller = new AbortController();
    controller.abort(new Error('timed out'));

    await expect(run(ctx(env, controller.signal))).rejects.toThrow('timed out');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('rejects without writing when the signal aborts while statements are being fetched', async () => {
    mockApi();
    const controller = new AbortController();
    let n = 0;
    server.use(
      http.get(`${BASE}/fins/summary`, () => {
        if (++n === 5) controller.abort(new Error('timed out'));
        return undefined;
      }),
    );

    await expect(run(ctx(env, controller.signal))).rejects.toThrow('timed out');
    expect(n).toBe(5);
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe('removeStaleDetails', () => {
  const detailDir = () => join(dir, 'stocks');

  it('deletes json files outside the keep set and leaves everything else', () => {
    mkdirSync(detailDir());
    for (const name of ['1301.json', '0000.json', 'notes.txt']) writeFileSync(join(detailDir(), name), '{}');

    removeStaleDetails(dir, new Set(['1301.json']));

    expect(readdirSync(detailDir()).sort()).toEqual(['1301.json', 'notes.txt']);
  });

  it('does nothing when the detail directory does not exist', () => {
    expect(() => removeStaleDetails(dir, new Set())).not.toThrow();
  });

  it('rethrows errors other than a missing directory', () => {
    writeFileSync(detailDir(), 'not a directory');
    expect(() => removeStaleDetails(dir, new Set())).toThrow();
  });
});

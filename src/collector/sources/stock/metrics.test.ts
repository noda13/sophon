import { describe, it, expect } from 'vitest';
import { buildStockDetail, buildStockMetrics, computeMetrics, computeNetCash } from './metrics';
import type { StatementRaw } from './jquants';
describe('computeNetCash', () => {
  it('returns null when currentAssets is null', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: null, totalAssets: 500, equity: 300, profit: null })).toBeNull();
  });

  it('returns null when totalAssets is null', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: null, equity: 300, profit: null })).toBeNull();
  });

  it('returns null when equity is null', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: null, profit: null })).toBeNull();
  });

  it('returns null when all balance-sheet fields are null (missing data scenario)', () => {
    expect(computeNetCash({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: null })).toBeNull();
  });

  it('computes correctly when all fields are present', () => {
    // NetCash = currentAssets + investSec*0.7 - (totalAssets - equity)
    // = 200 + 0 - (500 - 300) = 200 - 200 = 0
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, profit: null })).toBe(0);
  });

  it('handles positive net cash', () => {
    // = 400 - (500 - 300) = 400 - 200 = 200
    expect(computeNetCash({ marketCap: 1000, currentAssets: 400, totalAssets: 500, equity: 300, profit: null })).toBe(200);
  });

  it('handles negative net cash (net debt)', () => {
    // = 100 - (500 - 300) = 100 - 200 = -100
    expect(computeNetCash({ marketCap: 1000, currentAssets: 100, totalAssets: 500, equity: 300, profit: null })).toBe(-100);
  });

  it('includes investmentSecurities at 70%', () => {
    // = 200 + 100*0.7 - (500-300) = 200 + 70 - 200 = 70
    expect(computeNetCash({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, investmentSecurities: 100, profit: null })).toBe(70);
  });
});

describe('computeMetrics', () => {
  it('netCashRatio is null when balance-sheet data is missing', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: null });
    expect(result.netCash).toBeNull();
    expect(result.netCashRatio).toBeNull();
  });

  it('netCashRatio is null when marketCap is 0', () => {
    const result = computeMetrics({ marketCap: 0, currentAssets: 200, totalAssets: 500, equity: 300, profit: null });
    expect(result.netCashRatio).toBeNull();
  });

  it('netCashRatio is computed correctly when data is present', () => {
    // netCash = 200 - 200 = 0, netCashRatio = 0/1000 = 0
    const result = computeMetrics({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, profit: null });
    expect(result.netCashRatio).toBe(0);
  });

  it('cashNeutralPer is null when netCash is null', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: 100 });
    expect(result.cashNeutralPer).toBeNull();
  });

  it('per is null for loss-making companies', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: 200, totalAssets: 500, equity: 300, profit: -50 });
    expect(result.per).toBeNull();
  });

  it('pbr is null when equity is null or zero', () => {
    const result = computeMetrics({ marketCap: 1000, currentAssets: null, totalAssets: null, equity: null, profit: null });
    expect(result.pbr).toBeNull();
  });
});

describe('buildStockMetrics / buildStockDetail', () => {
  const info = { code: '1301', name: '極洋', sector33Name: '水産・農林業', sector33Code: '0050', marketSegment: 'プライム', sharesOutstanding: 0 };
  const stmt = (over: Partial<StatementRaw>): StatementRaw => ({
    code: '1301',
    fiscalYear: 2025,
    typeOfCurrentPeriod: 'FY',
    disclosedDate: new Date('2025-05-01T00:00:00Z'),
    periodEndDate: new Date('2025-03-31T00:00:00Z'),
    netSales: 1000,
    operatingProfit: 100,
    ordinaryProfit: 90,
    profit: 50,
    totalAssets: 500,
    equity: 300,
    currentAssets: 400,
    cashAndEquivalents: null,
    sharesOutstanding: 10,
    ...over,
  });
  const price = { code: '1301', date: new Date('2026-03-06T00:00:00Z'), close: 100 };

  it('prefers the latest FY statement for the balance sheet even when a newer quarter exists', () => {
    const m = buildStockMetrics(
      info,
      [stmt({}), stmt({ typeOfCurrentPeriod: '3Q', disclosedDate: new Date('2026-02-01T00:00:00Z'), currentAssets: null, profit: 999 })],
      price,
    );
    expect(m).toMatchObject({ marketCap: 1000, netCash: 200, profit: 50, per: 20, pbr: 1000 / 300 });
  });

  it('returns null without a price, statements or a positive market cap', () => {
    expect(buildStockMetrics(info, [stmt({})], undefined)).toBeNull();
    expect(buildStockMetrics(info, [], price)).toBeNull();
    expect(buildStockMetrics(info, [stmt({ sharesOutstanding: null })], price)).toBeNull();
  });

  it('limits history to 8 statements, newest first, and builds a snapshot', () => {
    const many = Array.from({ length: 10 }, (_, i) => stmt({ fiscalYear: 2000 + i, disclosedDate: new Date(Date.UTC(2000 + i, 0, 1)) }));
    const d = buildStockDetail(info, many, price, {}, new Date('2026-06-01T00:00:00Z'));
    expect(d.history).toHaveLength(8);
    expect(d.history[0]?.fiscalYear).toBe(2009);
    expect(d.profile.snapshots).toHaveLength(1);
    expect(d.profile.updatedAt).toBe('2026-06-01T00:00:00.000Z');
  });

  it('has no snapshot when the price is missing', () => {
    expect(buildStockDetail(info, [stmt({})], undefined, {}, new Date()).profile.snapshots).toEqual([]);
  });
});

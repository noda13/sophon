import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../lib/prisma.js';
import { resetDb } from '../../../test/db.js';
import type { DataProvider } from '../../providers/DataProvider.js';
import { isSyncing, runSync } from '../syncOrchestrator.js';

function makeProvider(overrides: Partial<DataProvider> = {}): DataProvider {
  return {
    name: 'fake',
    listStocks: async () => [
      { code: '1001', name: 'A', sector33Code: '3650', sector33Name: '電気機器', marketSegment: 'プライム', sharesOutstanding: 1000 },
      { code: '1002', name: 'ETF', sector33Code: '9999', sector33Name: 'その他', sharesOutstanding: 1 },
    ],
    fetchStatements: async (code: string) => [
      {
        code,
        fiscalYear: 2025,
        typeOfCurrentPeriod: 'FY',
        disclosedDate: new Date('2026-01-10'),
        periodEndDate: new Date('2025-12-31'),
        netSales: 100,
        operatingProfit: 10,
        ordinaryProfit: 10,
        profit: 5,
        totalAssets: 500,
        equity: 300,
        currentAssets: 400,
        cashAndEquivalents: 50,
        sharesOutstanding: 1000,
      },
    ],
    fetchPrices: async (code: string) => [
      { code, date: new Date('2026-01-09'), close: 100 },
      { code, date: new Date('2026-01-10'), close: 110 },
    ],
    ...overrides,
  } as DataProvider;
}

describe('runSync', () => {
  beforeEach(resetDb);

  it('persists stocks, statements, prices and a snapshot; skips funds', async () => {
    const res = await runSync({ provider: makeProvider() });
    expect(res).toEqual({ stocks: 1, snapshots: 1 });
    expect(await prisma.stock.count()).toBe(1);
    expect(await prisma.financialStatement.count()).toBe(1);
    expect(await prisma.dailyPrice.count()).toBe(2);
    const snap = await prisma.screeningSnapshot.findFirstOrThrow();
    expect(snap.marketCap).toBe(1000 * 110);
    const log = await prisma.collectionLog.findFirstOrThrow();
    expect(log.status).toBe('success');
    expect(isSyncing()).toBe(false);
  });

  it('is idempotent for statements and prices on re-run', async () => {
    await runSync({ provider: makeProvider() });
    await runSync({ provider: makeProvider() });
    expect(await prisma.financialStatement.count()).toBe(1);
    expect(await prisma.dailyPrice.count()).toBe(2);
  });

  it('resets the in-progress flag and marks the log failed on error', async () => {
    const provider = makeProvider({
      fetchPrices: async () => {
        throw new Error('boom');
      },
    });
    await expect(runSync({ provider })).rejects.toThrow('boom');
    expect(isSyncing()).toBe(false);
    const log = await prisma.collectionLog.findFirstOrThrow();
    expect(log.status).toBe('failed');
    expect(log.message).toBe('boom');
  });
});

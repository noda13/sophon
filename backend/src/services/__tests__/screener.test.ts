import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../lib/prisma.js';
import { resetDb } from '../../../test/db.js';
import { invalidateScreenerCache, listRanking, rankByStrategyId } from '../screener.js';

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

async function seedStock(
  code: string,
  snaps: { at: Date; marketCap: number; netCashRatio: number; cashNeutralPer?: number }[],
) {
  await prisma.stock.create({
    data: { code, name: `N${code}`, sector33Name: '電気機器', marketSegment: 'プライム' },
  });
  for (const s of snaps) {
    await prisma.screeningSnapshot.create({
      data: {
        code,
        snapshotAt: s.at,
        marketCap: s.marketCap,
        netCash: 1,
        netCashRatio: s.netCashRatio,
        cashNeutralPer: s.cashNeutralPer ?? 5,
        per: 10,
        pbr: 1,
      },
    });
  }
}

describe('screener', () => {
  beforeEach(async () => {
    await resetDb();
    invalidateScreenerCache();
  });

  it('uses only the latest snapshot per code', async () => {
    await seedStock('1001', [
      { at: day(1), marketCap: 1e9, netCashRatio: 0.9 },
      { at: day(5), marketCap: 1e9, netCashRatio: 0.1 },
    ]);
    await seedStock('1002', [{ at: day(2), marketCap: 1e9, netCashRatio: 0.5 }]);

    const rows = await listRanking({ metric: 'netCashRatio' });
    expect(rows.map(r => [r.code, r.netCashRatio])).toEqual([
      ['1002', 0.5],
      ['1001', 0.1],
    ]);
    expect(rows.map(r => r.rank)).toEqual([1, 2]);
  });

  it('caches results until invalidated', async () => {
    await seedStock('1001', [{ at: day(1), marketCap: 1e9, netCashRatio: 0.5 }]);
    expect((await rankByStrategyId('kiyohara')).length).toBe(1);

    await seedStock('1002', [{ at: day(1), marketCap: 1e9, netCashRatio: 0.6 }]);
    expect((await rankByStrategyId('kiyohara')).length).toBe(1);

    invalidateScreenerCache();
    expect((await rankByStrategyId('kiyohara')).length).toBe(2);
  });

  it('throws NotFound for an unknown strategy', async () => {
    await expect(rankByStrategyId('nope')).rejects.toThrow(/not found/i);
  });
});

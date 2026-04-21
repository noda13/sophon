import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';

export interface RankingRow {
  rank: number;
  code: string;
  name: string;
  sector33Name: string | null;
  marketSegment: string | null;
  marketCap: number;
  netCash: number;
  netCashRatio: number;
  cashNeutralPer: number | null;
  per: number | null;
  pbr: number | null;
  snapshotAt: string;
}

export async function listRanking(opts: {
  metric: 'netCashRatio' | 'cashNeutralPer';
  limit?: number;
  maxMarketCap?: number;
}): Promise<RankingRow[]> {
  const limit = opts.limit ?? 50;
  const maxMarketCap = opts.maxMarketCap ?? config.marketCapMaxYen;

  // Get the latest snapshot per code efficiently:
  // Get all distinct codes, then for each find the latest snapshot
  const codes = await prisma.screeningSnapshot.findMany({
    select: { code: true },
    distinct: ['code'],
  });

  if (codes.length === 0) return [];

  const rows: RankingRow[] = [];

  for (const { code } of codes) {
    const snapshot = await prisma.screeningSnapshot.findFirst({
      where: {
        code,
        marketCap: { lte: maxMarketCap },
      },
      orderBy: { snapshotAt: 'desc' },
      include: { stock: true },
    });
    if (!snapshot) continue;
    // For cashNeutralPer metric, skip nulls
    if (opts.metric === 'cashNeutralPer' && snapshot.cashNeutralPer === null) continue;

    rows.push({
      rank: 0, // set after sort
      code: snapshot.code,
      name: snapshot.stock.name,
      sector33Name: snapshot.stock.sector33Name,
      marketSegment: snapshot.stock.marketSegment,
      marketCap: snapshot.marketCap,
      netCash: snapshot.netCash,
      netCashRatio: snapshot.netCashRatio,
      cashNeutralPer: snapshot.cashNeutralPer,
      per: snapshot.per,
      pbr: snapshot.pbr,
      snapshotAt: snapshot.snapshotAt.toISOString(),
    });
  }

  // Sort
  if (opts.metric === 'netCashRatio') {
    rows.sort((a, b) => b.netCashRatio - a.netCashRatio);
  } else {
    rows.sort((a, b) => (a.cashNeutralPer ?? Infinity) - (b.cashNeutralPer ?? Infinity));
  }

  // Apply limit and assign rank
  return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

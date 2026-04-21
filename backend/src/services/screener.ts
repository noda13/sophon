import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';
import type { StockMetrics, RankingRow as StrategyRankingRow, RankingOpts } from '../strategies/InvestmentStrategy.js';
import { getStrategy, activeStrategies } from '../strategies/index.js';
import type { InvestmentStrategy } from '../strategies/InvestmentStrategy.js';

// Legacy type for backward compatibility
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

/**
 * Fetch latest snapshots from DB and build StockMetrics array
 */
async function fetchStockMetrics(maxMarketCap?: number): Promise<StockMetrics[]> {
  const cap = maxMarketCap ?? config.marketCapMaxYen;

  const codes = await prisma.screeningSnapshot.findMany({
    select: { code: true },
    distinct: ['code'],
  });

  if (codes.length === 0) return [];

  const metrics: StockMetrics[] = [];

  for (const { code } of codes) {
    const snapshot = await prisma.screeningSnapshot.findFirst({
      where: { code },
      orderBy: { snapshotAt: 'desc' },
      include: { stock: true },
    });
    if (!snapshot) continue;

    // Fetch profit and equity from latest statement for strategy scoring
    const stmt = await prisma.financialStatement.findFirst({
      where: { code },
      orderBy: { disclosedDate: 'desc' },
    });

    metrics.push({
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
      profit: stmt?.profit ?? null,
      equity: stmt?.equity ?? null,
    });
  }

  return metrics;
}

/**
 * Rank stocks using a specific strategy
 */
export async function rankByStrategy(
  strategy: InvestmentStrategy,
  opts?: RankingOpts & { maxMarketCap?: number }
): Promise<StrategyRankingRow[]> {
  const allMetrics = await fetchStockMetrics(opts?.maxMarketCap);
  return strategy.rank(allMetrics, opts);
}

/**
 * Rank stocks using strategy ID
 */
export async function rankByStrategyId(
  strategyId: string,
  opts?: RankingOpts
): Promise<StrategyRankingRow[]> {
  const strategy = getStrategy(strategyId as any);
  if (!strategy) throw new Error(`Strategy not found: ${strategyId}`);
  return rankByStrategy(strategy, opts);
}

/**
 * Get strategy scores for a single stock
 */
export async function getStockStrategyScores(code: string): Promise<Record<string, import('../strategies/InvestmentStrategy.js').StrategyScore>> {
  const snapshot = await prisma.screeningSnapshot.findFirst({
    where: { code },
    orderBy: { snapshotAt: 'desc' },
    include: { stock: true },
  });
  if (!snapshot) throw new Error(`Stock ${code} not found`);

  const stmt = await prisma.financialStatement.findFirst({
    where: { code },
    orderBy: { disclosedDate: 'desc' },
  });

  const m: StockMetrics = {
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
    profit: stmt?.profit ?? null,
    equity: stmt?.equity ?? null,
  };

  const result: Record<string, import('../strategies/InvestmentStrategy.js').StrategyScore> = {};
  for (const strategy of activeStrategies()) {
    result[strategy.meta.id] = strategy.score(m);
  }
  return result;
}

/**
 * Legacy listRanking — uses KiyoharaStrategy internally for backward compatibility
 */
export async function listRanking(opts: {
  metric: 'netCashRatio' | 'cashNeutralPer';
  limit?: number;
  maxMarketCap?: number;
}): Promise<RankingRow[]> {
  const limit = opts.limit ?? 50;
  const maxMarketCap = opts.maxMarketCap ?? config.marketCapMaxYen;

  const strategy = getStrategy('kiyohara');
  if (!strategy) throw new Error('KiyoharaStrategy not found');

  const rows = await rankByStrategy(strategy, { limit: 200, maxMarketCap });

  // Map to legacy format
  let legacyRows: RankingRow[] = rows.map(r => ({
    rank: 0,
    code: r.code,
    name: r.name,
    sector33Name: r.sector33Name,
    marketSegment: r.marketSegment,
    marketCap: r.marketCap,
    netCash: r.netCash,
    netCashRatio: r.netCashRatio,
    cashNeutralPer: r.cashNeutralPer,
    per: r.per,
    pbr: r.pbr,
    snapshotAt: r.snapshotAt,
  }));

  // Re-sort by requested metric
  if (opts.metric === 'netCashRatio') {
    legacyRows.sort((a, b) => b.netCashRatio - a.netCashRatio);
  } else {
    // cashNeutralPer: ascending, skip nulls
    legacyRows = legacyRows.filter(r => r.cashNeutralPer !== null);
    legacyRows.sort((a, b) => (a.cashNeutralPer ?? Infinity) - (b.cashNeutralPer ?? Infinity));
  }

  return legacyRows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

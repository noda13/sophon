import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import { config } from '../lib/config.js';
import type {
  StockMetrics,
  RankingRow as StrategyRankingRow,
  RankingOpts,
} from '../strategies/InvestmentStrategy.js';
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
  netCash: number | null;
  netCashRatio: number | null;
  cashNeutralPer: number | null;
  per: number | null;
  pbr: number | null;
  snapshotAt: string;
}

const METRICS_CACHE_TTL_MS = 60_000;
let metricsCache: { at: number; rows: StockMetrics[] } | null = null;

export function invalidateScreenerCache(): void {
  metricsCache = null;
}

interface MetricsRow {
  code: string;
  name: string;
  sector33Name: string | null;
  marketSegment: string | null;
  marketCap: number;
  netCash: number | null;
  netCashRatio: number | null;
  cashNeutralPer: number | null;
  per: number | null;
  pbr: number | null;
  profit: number | null;
  equity: number | null;
}

async function fetchStockMetrics(): Promise<StockMetrics[]> {
  if (metricsCache && Date.now() - metricsCache.at < METRICS_CACHE_TTL_MS) {
    return metricsCache.rows;
  }
  // id tie-break keeps exactly one row per code when timestamps collide
  const rows = await prisma.$queryRaw<MetricsRow[]>`
    SELECT ss.code AS code, st.name AS name, st.sector33Name AS sector33Name,
           st.marketSegment AS marketSegment, ss.marketCap AS marketCap,
           ss.netCash AS netCash, ss.netCashRatio AS netCashRatio,
           ss.cashNeutralPer AS cashNeutralPer, ss.per AS per, ss.pbr AS pbr,
           fs.profit AS profit, fs.equity AS equity
    FROM screening_snapshots ss
    JOIN stocks st ON st.code = ss.code
    LEFT JOIN financial_statements fs ON fs.id = (
      SELECT f.id FROM financial_statements f
      WHERE f.code = ss.code
      ORDER BY f.disclosedDate DESC, f.id DESC LIMIT 1
    )
    WHERE ss.id = (
      SELECT s2.id FROM screening_snapshots s2
      WHERE s2.code = ss.code
      ORDER BY s2.snapshotAt DESC, s2.id DESC LIMIT 1
    )
  `;
  metricsCache = { at: Date.now(), rows };
  return rows;
}

/**
 * Rank stocks using a specific strategy
 */
export async function rankByStrategy(
  strategy: InvestmentStrategy,
  opts?: RankingOpts & { maxMarketCap?: number }
): Promise<StrategyRankingRow[]> {
  const allMetrics = await fetchStockMetrics();
  return strategy.rank(allMetrics, opts);
}

/**
 * Rank stocks using strategy ID
 */
export async function rankByStrategyId(
  strategyId: string,
  opts?: RankingOpts
): Promise<StrategyRankingRow[]> {
  const strategy = getStrategy(strategyId);
  if (!strategy) throw new NotFoundError(`Strategy not found: ${strategyId}`);
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
  if (!snapshot) throw new NotFoundError(`Stock ${code} not found`);

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
    legacyRows.sort((a, b) => (b.netCashRatio ?? -Infinity) - (a.netCashRatio ?? -Infinity));
  } else {
    // cashNeutralPer: ascending, skip nulls
    legacyRows = legacyRows.filter(r => r.cashNeutralPer !== null);
    legacyRows.sort((a, b) => (a.cashNeutralPer ?? Infinity) - (b.cashNeutralPer ?? Infinity));
  }

  return legacyRows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

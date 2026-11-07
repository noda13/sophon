import type {
  InvestmentStrategy,
  StockMetrics,
  RankingRow,
  RankingOpts,
} from './InvestmentStrategy.js';

export const BILLION = 100_000_000;

export interface RankConfig {
  defaultMaxMarketCap: number;
  eligible?: (s: StockMetrics) => boolean;
}

export function rankStocks(
  strategy: Pick<InvestmentStrategy, 'score'>,
  stocks: StockMetrics[],
  opts: RankingOpts | undefined,
  config: RankConfig,
): RankingRow[] {
  const limit = opts?.limit ?? 50;
  const maxMarketCap = opts?.maxMarketCap ?? config.defaultMaxMarketCap;
  const minMarketCap = opts?.minMarketCap ?? 0;
  const excludeSectors = opts?.excludeSectors ?? [];
  const now = new Date().toISOString();

  const filtered = stocks.filter(s => {
    if (s.marketCap > maxMarketCap || s.marketCap < minMarketCap) return false;
    if (config.eligible && !config.eligible(s)) return false;
    if (excludeSectors.length > 0 && s.sector33Name && excludeSectors.includes(s.sector33Name)) return false;
    return true;
  });

  const scored = filtered.map(s => ({ ...s, rank: 0, strategyScore: strategy.score(s), snapshotAt: now }));
  scored.sort((a, b) => b.strategyScore.score - a.strategyScore.score);
  return scored.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
}

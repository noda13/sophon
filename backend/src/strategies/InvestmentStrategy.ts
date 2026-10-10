import type {
  RankingRow,
  StockMetrics,
  StrategyId,
  StrategyMeta,
  StrategyScore,
} from '@waga-scope/shared';

export type { RankingRow, StockMetrics, StrategyId, StrategyMeta, StrategyScore };

export interface RankingOpts {
  limit?: number;
  maxMarketCap?: number;
  minMarketCap?: number;
  excludeSectors?: string[];
}

export interface InvestmentStrategy {
  meta: StrategyMeta;
  score(m: StockMetrics): StrategyScore;
  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[];
}

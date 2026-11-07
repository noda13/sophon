import type {
  RankingRow,
  StockMetrics,
  StrategyId,
  StrategyMeta,
  StrategyScore,
} from '../../../../shared/schema/stock';

export type { RankingRow, StockMetrics, StrategyId, StrategyMeta, StrategyScore };

export interface RankingOpts {
  limit?: number;
  maxMarketCap?: number;
  minMarketCap?: number;
  excludeSectors?: string[];
  now?: Date;
}

export interface InvestmentStrategy {
  meta: StrategyMeta;
  score(m: StockMetrics): StrategyScore;
  rank(stocks: StockMetrics[], opts?: RankingOpts): RankingRow[];
}

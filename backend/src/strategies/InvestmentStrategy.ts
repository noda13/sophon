export type StrategyId = 'kiyohara' | 'graham' | 'buffett' | 'lynch' | 'dividend' | 'composite';

export interface StrategyMeta {
  id: StrategyId;
  displayName: string;
  description: string;
  active: boolean;
}

export interface StockMetrics {
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
  profit: number | null;
  equity: number | null;
}

export interface StrategyScore {
  score: number;
  components: Record<string, number | null>;
  reason: string;
}

export interface RankingRow extends StockMetrics {
  rank: number;
  strategyScore: StrategyScore;
  snapshotAt: string;
}

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

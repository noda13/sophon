// --- Strategy types (matching backend) ---

export type StrategyId = 'kiyohara' | 'graham' | 'buffett' | 'lynch' | 'dividend';

export interface StrategyMeta {
  id: StrategyId;
  displayName: string;
  description: string;
  active: boolean;
}

export interface StrategyScore {
  score: number;
  components: Record<string, number | null>;
  reason: string;
}

// --- Stock types ---

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

export interface RankingRow extends StockMetrics {
  rank: number;
  strategyScore: StrategyScore;
  snapshotAt: string;
}

// Legacy ranking row (for backward compat with old API)
export interface LegacyRankingRow {
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

export interface StockProfile {
  code: string;
  name: string;
  sector33Name: string | null;
  sector33Code: string | null;
  sector17Code: string | null;
  marketSegment: string | null;
  scaleCategory: string | null;
  updatedAt: string;
  snapshots: Array<{
    id: string;
    snapshotAt: string;
    marketCap: number;
    netCash: number;
    netCashRatio: number;
    cashNeutralPer: number | null;
    per: number | null;
    pbr: number | null;
  }>;
  statements?: FinancialStatement[];
}

export interface FinancialStatement {
  id: string;
  code: string;
  fiscalYear: number;
  typeOfCurrentPeriod: string;
  disclosedDate: string;
  periodEndDate: string;
  netSales: number | null;
  operatingProfit: number | null;
  ordinaryProfit: number | null;
  profit: number | null;
  totalAssets: number | null;
  equity: number | null;
  cashAndEquivalents: number | null;
  sharesOutstanding: number | null;
}

export interface Snapshot {
  id: string;
  code: string;
  snapshotAt: string;
  marketCap: number;
  netCash: number;
  netCashRatio: number;
  cashNeutralPer: number | null;
  per: number | null;
  pbr: number | null;
}

// Static JSON structure for collect-static output
export interface StaticStockDetail {
  profile: StockProfile;
  history: FinancialStatement[];
  strategies: Record<string, StrategyScore>;
}

export interface StaticMeta {
  generatedAt: string;
  provider: string;
  stockCount: number;
}

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

export interface MetricInputs {
  marketCap: number;
  currentAssets: number | null;
  totalAssets: number | null;
  equity: number | null;
  investmentSecurities?: number | null; // Phase 2 で使用。Phase 0/1 は null
  profit: number | null;
}

export interface MetricOutputs {
  netCash: number;
  netCashRatio: number;
  cashNeutralPer: number | null;
  per: number | null;
  pbr: number | null;
}

/**
 * 時価総額 = 株価 × 発行済株式数
 */
export function computeMarketCap(sharesOutstanding: number, closePrice: number): number {
  return sharesOutstanding * closePrice;
}

/**
 * 清原流ネットキャッシュ:
 * NetCash = 流動資産 + 投資有価証券×0.7 − 負債合計
 * 負債合計 = 総資産 − 純資産
 * Phase 0/1: 投資有価証券 = 0 (保守的)
 */
export function computeNetCash(inputs: MetricInputs): number {
  const currentAssets = inputs.currentAssets ?? 0;
  const investSec = (inputs.investmentSecurities ?? 0) * 0.7;
  const totalAssets = inputs.totalAssets ?? 0;
  const equity = inputs.equity ?? 0;
  const totalLiabilities = totalAssets - equity;
  return currentAssets + investSec - totalLiabilities;
}

/**
 * 全指標を計算
 */
export function computeMetrics(inputs: MetricInputs): MetricOutputs {
  const netCash = computeNetCash(inputs);
  const netCashRatio = inputs.marketCap > 0 ? netCash / inputs.marketCap : 0;

  const profit = inputs.profit;
  const cashNeutralPer =
    profit !== null && profit > 0
      ? (inputs.marketCap - netCash) / profit
      : null;

  const per =
    profit !== null && profit > 0
      ? inputs.marketCap / profit
      : null;

  const equity = inputs.equity;
  const pbr =
    equity !== null && equity > 0
      ? inputs.marketCap / equity
      : null;

  return { netCash, netCashRatio, cashNeutralPer, per, pbr };
}

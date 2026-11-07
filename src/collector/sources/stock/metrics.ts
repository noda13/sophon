import type { FinancialStatement, StockDetail, StockMetrics, StrategyScore } from '../../../shared/schema/stock';
import type { PriceRaw, StatementRaw, StockInfo } from './jquants';

export interface MetricInputs {
  marketCap: number;
  currentAssets: number | null;
  totalAssets: number | null;
  equity: number | null;
  investmentSecurities?: number | null;
  profit: number | null;
}

export interface MetricOutputs {
  netCash: number | null;
  netCashRatio: number | null;
  cashNeutralPer: number | null;
  per: number | null;
  pbr: number | null;
}

export const HISTORY_LENGTH = 8;

export function computeMarketCap(sharesOutstanding: number, closePrice: number): number {
  return sharesOutstanding * closePrice;
}

// NetCash = current assets + 0.7 * investment securities - total liabilities (Kiyohara style).
// Investment securities are not collected, so they count as 0 (conservative).
export function computeNetCash(inputs: MetricInputs): number | null {
  if (inputs.currentAssets === null || inputs.totalAssets === null || inputs.equity === null) {
    return null;
  }
  const investSec = (inputs.investmentSecurities ?? 0) * 0.7;
  const totalLiabilities = inputs.totalAssets - inputs.equity;
  return inputs.currentAssets + investSec - totalLiabilities;
}

export function computeMetrics(inputs: MetricInputs): MetricOutputs {
  const netCash = computeNetCash(inputs);
  const netCashRatio = netCash === null || inputs.marketCap <= 0 ? null : netCash / inputs.marketCap;

  const profit = inputs.profit;
  const cashNeutralPer =
    netCash !== null && profit !== null && profit > 0 ? (inputs.marketCap - netCash) / profit : null;
  const per = profit !== null && profit > 0 ? inputs.marketCap / profit : null;

  const equity = inputs.equity;
  const pbr = equity !== null && equity > 0 ? inputs.marketCap / equity : null;

  return { netCash, netCashRatio, cashNeutralPer, per, pbr };
}

function byDisclosedDesc(a: StatementRaw, b: StatementRaw): number {
  return b.disclosedDate.getTime() - a.disclosedDate.getTime();
}

// Quarterly reports often lack current assets, so the balance-sheet metrics prefer the latest annual (FY) report.
function pickLatestStatement(sortedDesc: StatementRaw[]): StatementRaw | undefined {
  return sortedDesc.find((s) => s.typeOfCurrentPeriod === 'FY') ?? sortedDesc[0];
}

function metricsFor(latest: StatementRaw, marketCap: number): MetricOutputs {
  return computeMetrics({
    marketCap,
    currentAssets: latest.currentAssets,
    totalAssets: latest.totalAssets,
    equity: latest.equity,
    investmentSecurities: null,
    profit: latest.profit,
  });
}

export function buildStockMetrics(
  info: StockInfo,
  statements: StatementRaw[],
  price: PriceRaw | undefined,
): StockMetrics | null {
  if (statements.length === 0 || !price) return null;

  const latest = pickLatestStatement([...statements].sort(byDisclosedDesc));
  if (!latest) return null;

  const marketCap = computeMarketCap(latest.sharesOutstanding ?? info.sharesOutstanding, price.close);
  if (!(marketCap > 0)) return null;

  const m = metricsFor(latest, marketCap);
  return {
    code: info.code,
    name: info.name,
    sector33Name: info.sector33Name ?? null,
    marketSegment: info.marketSegment ?? null,
    marketCap,
    netCash: m.netCash,
    netCashRatio: m.netCashRatio,
    cashNeutralPer: m.cashNeutralPer,
    per: m.per,
    pbr: m.pbr,
    profit: latest.profit,
    equity: latest.equity,
  };
}

function toFinancialStatement(code: string, s: StatementRaw): FinancialStatement {
  return {
    id: `static-${code}-${s.fiscalYear}-${s.typeOfCurrentPeriod}`,
    code: s.code,
    fiscalYear: s.fiscalYear,
    typeOfCurrentPeriod: s.typeOfCurrentPeriod,
    disclosedDate: s.disclosedDate.toISOString(),
    periodEndDate: s.periodEndDate.toISOString(),
    netSales: s.netSales,
    operatingProfit: s.operatingProfit,
    ordinaryProfit: s.ordinaryProfit,
    profit: s.profit,
    totalAssets: s.totalAssets,
    equity: s.equity,
    cashAndEquivalents: s.cashAndEquivalents,
    sharesOutstanding: s.sharesOutstanding,
  };
}

export function buildStockDetail(
  info: StockInfo,
  statements: StatementRaw[],
  price: PriceRaw | undefined,
  scores: Record<string, StrategyScore>,
  now: Date,
): StockDetail {
  const history = [...statements].sort(byDisclosedDesc).slice(0, HISTORY_LENGTH);
  const latest = pickLatestStatement(history);

  const marketCap = latest && price ? computeMarketCap(latest.sharesOutstanding ?? info.sharesOutstanding, price.close) : 0;
  const snapshotMetrics = latest && marketCap > 0 ? metricsFor(latest, marketCap) : null;
  const at = now.toISOString();

  return {
    profile: {
      code: info.code,
      name: info.name,
      sector33Name: info.sector33Name ?? null,
      sector33Code: info.sector33Code ?? null,
      sector17Code: info.sector17Code ?? null,
      marketSegment: info.marketSegment ?? null,
      scaleCategory: info.scaleCategory ?? null,
      updatedAt: at,
      snapshots: snapshotMetrics
        ? [
            {
              id: `static-${info.code}`,
              snapshotAt: at,
              marketCap,
              netCash: snapshotMetrics.netCash,
              netCashRatio: snapshotMetrics.netCashRatio,
              cashNeutralPer: snapshotMetrics.cashNeutralPer,
              per: snapshotMetrics.per,
              pbr: snapshotMetrics.pbr,
            },
          ]
        : [],
    },
    history: history.map((s) => toFinancialStatement(info.code, s)),
    strategies: scores,
  };
}

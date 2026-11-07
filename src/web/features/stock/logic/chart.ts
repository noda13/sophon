import type { FinancialStatement } from '../../../../shared/schema/stock';
import { OKU_YEN } from './filters';

export interface FinancialPoint {
  period: string;
  netSales: number | null;
  profit: number | null;
  cash: number | null;
  equity: number | null;
}

const toOku = (n: number | null): number | null => (n === null ? null : n / OKU_YEN);

export function periodLabel(s: Pick<FinancialStatement, 'fiscalYear' | 'typeOfCurrentPeriod'>): string {
  return `${s.fiscalYear}${s.typeOfCurrentPeriod === 'FY' ? '' : s.typeOfCurrentPeriod}`;
}

// 開示日の昇順に並べるのは、四半期と通期が混ざる履歴を時系列のまま折れ線にするため
export function toFinancialPoints(history: readonly FinancialStatement[]): FinancialPoint[] {
  return [...history]
    .sort((a, b) => new Date(a.disclosedDate).getTime() - new Date(b.disclosedDate).getTime())
    .map((s) => ({
      period: periodLabel(s),
      netSales: toOku(s.netSales),
      profit: toOku(s.profit),
      cash: toOku(s.cashAndEquivalents),
      equity: toOku(s.equity),
    }));
}

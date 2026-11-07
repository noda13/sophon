import { describe, expect, it } from 'vitest';
import type { FinancialStatement } from '../../../../shared/schema/stock';
import { buildExternalLinks } from './externalLinks';
import { periodLabel, toFinancialPoints } from './chart';

function statement(over: Partial<FinancialStatement>): FinancialStatement {
  return {
    id: 'x',
    code: '1301',
    fiscalYear: 2025,
    typeOfCurrentPeriod: 'FY',
    disclosedDate: '2026-01-01T00:00:00.000Z',
    periodEndDate: '2025-12-31T00:00:00.000Z',
    netSales: null,
    operatingProfit: null,
    ordinaryProfit: null,
    profit: null,
    totalAssets: null,
    equity: null,
    cashAndEquivalents: null,
    sharesOutstanding: null,
    ...over,
  };
}

describe('toFinancialPoints', () => {
  it('開示日の昇順に並べ、金額を億円にする', () => {
    const points = toFinancialPoints([
      statement({ fiscalYear: 2025, typeOfCurrentPeriod: '3Q', disclosedDate: '2026-02-06T00:00:00.000Z', netSales: 2e10 }),
      statement({ fiscalYear: 2024, typeOfCurrentPeriod: 'FY', disclosedDate: '2025-05-10T00:00:00.000Z', netSales: 3e10, profit: 1e9 }),
    ]);
    expect(points.map((p) => p.period)).toEqual(['2024', '20253Q']);
    expect(points[0]).toMatchObject({ netSales: 300, profit: 10, cash: null, equity: null });
  });

  it('入力を並べ替えない', () => {
    const input = [
      statement({ disclosedDate: '2026-02-06T00:00:00.000Z' }),
      statement({ disclosedDate: '2025-05-10T00:00:00.000Z' }),
    ];
    toFinancialPoints(input);
    expect(input[0]?.disclosedDate).toBe('2026-02-06T00:00:00.000Z');
  });

  it('通期は種別を付けず、四半期は付ける', () => {
    expect(periodLabel({ fiscalYear: 2025, typeOfCurrentPeriod: 'FY' })).toBe('2025');
    expect(periodLabel({ fiscalYear: 2025, typeOfCurrentPeriod: '2Q' })).toBe('20252Q');
  });
});

describe('buildExternalLinks', () => {
  it('コードを URL に埋め、TDnet は日付を入れる', () => {
    const links = buildExternalLinks('130A', new Date(2026, 4, 3));
    expect(links.map((l) => l.label)).toEqual(['kabutan', 'IR BANK', 'EDINET', 'TDnet']);
    expect(links[0]?.url).toBe('https://kabutan.jp/stock/?code=130A');
    expect(links[3]?.url).toBe('https://www.release.tdnet.info/inbs/I_list_001_20260503.html');
  });

  it('コードは URL エスケープする', () => {
    expect(buildExternalLinks('a/b')[0]?.url).toContain('a%2Fb');
  });
});

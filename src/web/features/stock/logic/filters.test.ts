import { describe, expect, it } from 'vitest';
import type { RankingRow } from '../../../../shared/schema/stock';
import { OKU_YEN, filterRanking, hasActiveFilter, okuToYen, sectorOptions } from './filters';

function row(code: string, marketCap: number, sector: string | null): RankingRow {
  return {
    code,
    name: `name-${code}`,
    sector33Name: sector,
    marketSegment: null,
    marketCap,
    netCash: null,
    netCashRatio: null,
    cashNeutralPer: null,
    per: null,
    pbr: null,
    profit: null,
    equity: null,
    rank: 99,
    strategyScore: { score: 50, components: {}, reason: '' },
    snapshotAt: '2026-01-01T00:00:00.000Z',
  };
}

const rows = [
  row('1', 50 * OKU_YEN, '銀行業'),
  row('2', 200 * OKU_YEN, '情報・通信業'),
  row('3', 800 * OKU_YEN, '銀行業'),
  row('4', 300 * OKU_YEN, null),
];

const codes = (rs: RankingRow[]) => rs.map((r) => r.code);

describe('filterRanking', () => {
  it('条件がなければ全件を返し、順位は並びどおりに振る', () => {
    const result = filterRanking(rows, {});
    expect(codes(result)).toEqual(['1', '2', '3', '4']);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('時価総額の下限と上限は境界を含む', () => {
    expect(codes(filterRanking(rows, { minMarketCap: 200 * OKU_YEN, maxMarketCap: 300 * OKU_YEN }))).toEqual([
      '2',
      '4',
    ]);
  });

  it('除外セクターの銘柄を落とし、順位を振り直す', () => {
    const result = filterRanking(rows, { excludeSectors: ['銀行業'] });
    expect(codes(result)).toEqual(['2', '4']);
    expect(result.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('業種が不明の銘柄は除外セクターに引っかからない', () => {
    expect(codes(filterRanking(rows, { excludeSectors: ['情報・通信業'] }))).toContain('4');
  });

  it('入力を書き換えない', () => {
    filterRanking(rows, { excludeSectors: ['銀行業'] });
    expect(rows[0]?.rank).toBe(99);
  });
});

describe('sectorOptions', () => {
  it('重複と null を除いて並べる', () => {
    expect(sectorOptions(rows)).toEqual(['情報・通信業', '銀行業'].sort((a, b) => a.localeCompare(b, 'ja')));
  });
});

describe('hasActiveFilter / okuToYen', () => {
  it('絞り込み条件の有無を判定する', () => {
    expect(hasActiveFilter({})).toBe(false);
    expect(hasActiveFilter({ excludeSectors: [] })).toBe(false);
    expect(hasActiveFilter({ minMarketCap: 0 })).toBe(true);
    expect(hasActiveFilter({ excludeSectors: ['銀行業'] })).toBe(true);
  });

  it('億円を円に換算する', () => {
    expect(okuToYen(5)).toBe(500_000_000);
    expect(okuToYen(undefined)).toBeUndefined();
  });
});

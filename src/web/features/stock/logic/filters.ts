import type { RankingRow } from '../../../../shared/schema/stock';

export const OKU_YEN = 100_000_000;

export interface RankingFilter {
  minMarketCap?: number;
  maxMarketCap?: number;
  excludeSectors?: readonly string[];
}

export function hasActiveFilter(filter: RankingFilter): boolean {
  return (
    filter.minMarketCap !== undefined ||
    filter.maxMarketCap !== undefined ||
    (filter.excludeSectors?.length ?? 0) > 0
  );
}

// 順位は絞り込み後の並びで振り直す。旧 backend が絞り込んだ後に採番していたのと同じ
export function filterRanking(rows: readonly RankingRow[], filter: RankingFilter): RankingRow[] {
  const { minMarketCap, maxMarketCap, excludeSectors = [] } = filter;
  const excluded = new Set(excludeSectors);

  const kept = rows.filter((row) => {
    if (minMarketCap !== undefined && row.marketCap < minMarketCap) return false;
    if (maxMarketCap !== undefined && row.marketCap > maxMarketCap) return false;
    if (row.sector33Name !== null && excluded.has(row.sector33Name)) return false;
    return true;
  });
  return kept.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function sectorOptions(rows: readonly RankingRow[]): string[] {
  const sectors = new Set<string>();
  for (const row of rows) if (row.sector33Name) sectors.add(row.sector33Name);
  return [...sectors].sort((a, b) => a.localeCompare(b, 'ja'));
}

export function okuToYen(oku: number | undefined): number | undefined {
  return oku === undefined ? undefined : oku * OKU_YEN;
}

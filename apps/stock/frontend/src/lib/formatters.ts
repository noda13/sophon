/**
 * 億/兆 形式で金額を表示（円建て）
 */
export function formatYen(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) {
    return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}兆円`;
  }
  if (abs >= 100_000_000) {
    return `${sign}${(abs / 100_000_000).toFixed(1)}億円`;
  }
  if (abs >= 10_000) {
    return `${sign}${(abs / 10_000).toFixed(0)}万円`;
  }
  return `${sign}${abs.toFixed(0)}円`;
}

/**
 * 比率表示（小数点2桁、例: 1.20）
 */
export function formatRatio(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2);
}

/**
 * PER/CNPER 表示（小数点1桁、null は "—"）
 */
export function formatPer(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 0) return `${n.toFixed(1)}x (過剰)`;
  return `${n.toFixed(1)}x`;
}

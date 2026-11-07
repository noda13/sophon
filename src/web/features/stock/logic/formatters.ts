const MAN = 10_000;
const OKU = 100_000_000;
const CHO = 1_000_000_000_000;

export const EMPTY_VALUE = '—';

export function formatYen(n: number | null | undefined): string {
  if (n === null || n === undefined) return EMPTY_VALUE;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= CHO) return `${sign}${(abs / CHO).toFixed(1)}兆円`;
  if (abs >= OKU) return `${sign}${(abs / OKU).toFixed(1)}億円`;
  if (abs >= MAN) return `${sign}${(abs / MAN).toFixed(0)}万円`;
  return `${sign}${abs.toFixed(0)}円`;
}

export function formatRatio(n: number | null | undefined): string {
  if (n === null || n === undefined) return EMPTY_VALUE;
  return n.toFixed(2);
}

// PER と CNPER は、利益が負のとき倍率が負になる。割安の意味ではないので「過剰」と添える
export function formatPer(n: number | null | undefined): string {
  if (n === null || n === undefined) return EMPTY_VALUE;
  if (n < 0) return `${n.toFixed(1)}x (過剰)`;
  return `${n.toFixed(1)}x`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? EMPTY_VALUE : d.toLocaleString('ja-JP');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY_VALUE;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? EMPTY_VALUE : d.toLocaleDateString('ja-JP');
}

export type Tone = 'good' | 'fair' | 'poor' | 'none';

// NCR 1.0 以上はネットキャッシュが時価総額を上回る水準、0.3 以上は準ずる水準
export function netCashRatioTone(ratio: number | null): Tone {
  if (ratio === null) return 'none';
  if (ratio >= 1) return 'good';
  if (ratio >= 0.3) return 'fair';
  return 'poor';
}

export function netCashTone(netCash: number | null): Tone {
  if (netCash === null) return 'none';
  return netCash >= 0 ? 'good' : 'poor';
}

export type ScoreLevel = 'high' | 'upper' | 'middle' | 'low';

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 75) return 'high';
  if (score >= 55) return 'upper';
  if (score >= 40) return 'middle';
  return 'low';
}

export function scoreBarPercent(score: number): number {
  return Math.max(0, Math.min(100, score));
}

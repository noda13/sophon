import type { AssetAllocation } from './profile';
import { PROFILE_PRESETS, type ProfilePreset } from './profilePresets';
import { MAX_AGE, MIN_AGE } from './profileValidation';

export function allocationTotal(allocation: AssetAllocation): number {
  return Object.values(allocation).reduce((sum, v) => sum + v, 0);
}

export function allocationEquals(a: AssetAllocation, b: AssetAllocation): boolean {
  return (Object.keys(a) as (keyof AssetAllocation)[]).every((key) => a[key] === b[key]);
}

// 全角数字、小数、符号付きは受け付けない。入力欄の文字列をそのまま検証する
export function parseAge(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= MIN_AGE && n <= MAX_AGE ? n : null;
}

export function findActivePreset(allocation: AssetAllocation): ProfilePreset | undefined {
  return PROFILE_PRESETS.find((p) => allocationEquals(p.allocation, allocation));
}

// 保存できる状態なら null
export function describeSaveBlocker(ageValid: boolean, total: number): string | null {
  if (!ageValid) return `年齢を${MIN_AGE}〜${MAX_AGE}の整数で入力すると保存できます`;
  const diff = 100 - total;
  if (diff > 0) return `配分の合計があと${diff}%足りないため保存できません`;
  if (diff < 0) return `配分の合計が${-diff}%超過しているため保存できません`;
  return null;
}

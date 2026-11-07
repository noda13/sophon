import type { UserProfile } from './types/profile';

export const ALLOCATION_KEYS = [
  'domestic_equity', 'developed_equity', 'emerging_equity',
  'domestic_bond', 'developed_bond', 'emerging_bond',
  'domestic_reit', 'developed_reit', 'cash',
] as const;

export const MIN_AGE = 20;
export const MAX_AGE = 80;

// Mirrors what the profile modal can save: integer age and an allocation summing to exactly 100.
export function isValidProfile(obj: unknown): obj is UserProfile {
  if (obj === null || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;

  if (typeof p.age !== 'number' || !Number.isInteger(p.age) || p.age < MIN_AGE || p.age > MAX_AGE) return false;

  if (p.sensitivity !== 'sensitive' && p.sensitivity !== 'standard' && p.sensitivity !== 'relaxed') return false;

  if (p.allocation === null || typeof p.allocation !== 'object') return false;
  const alloc = p.allocation as Record<string, unknown>;
  for (const key of ALLOCATION_KEYS) {
    const value = alloc[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return false;
  }

  const sum = ALLOCATION_KEYS.reduce((acc, key) => acc + (alloc[key] as number), 0);
  return sum === 100;
}

import { z } from 'zod';
import type { UserProfile } from './profile';

export const ALLOCATION_KEYS = [
  'domestic_equity', 'developed_equity', 'emerging_equity',
  'domestic_bond', 'developed_bond', 'emerging_bond',
  'domestic_reit', 'developed_reit', 'cash',
] as const;

export const MIN_AGE = 20;
export const MAX_AGE = 80;

const percent = z.number().finite().min(0).max(100);

const AllocationSchema = z
  .object({
    domestic_equity: percent,
    developed_equity: percent,
    emerging_equity: percent,
    domestic_bond: percent,
    developed_bond: percent,
    emerging_bond: percent,
    domestic_reit: percent,
    developed_reit: percent,
    cash: percent,
  })
  .refine((alloc) => ALLOCATION_KEYS.reduce((sum, key) => sum + alloc[key], 0) === 100, {
    message: '配分の合計は 100% にしてください',
  });

// プロフィール編集ダイアログが保存できる形（整数の年齢、合計がちょうど 100 の配分）だけを受け付ける。
export const UserProfileSchema = z.object({
  age: z.number().int().min(MIN_AGE).max(MAX_AGE),
  sensitivity: z.enum(['sensitive', 'standard', 'relaxed']),
  allocation: AllocationSchema,
}) satisfies z.ZodType<UserProfile>;

export function isValidProfile(obj: unknown): obj is UserProfile {
  return UserProfileSchema.safeParse(obj).success;
}

import { useCallback } from 'react';
import { useStoredState } from '../../../composables/useStoredState';
import type { UserProfile } from '../logic/profile';
import { UserProfileSchema } from '../logic/profileValidation';

// 旧アプリの利用者が保存した設定を引き継ぐため、キーは変えない
export const PROFILE_STORAGE_KEY = 'econoguard-profile';

const NullableProfileSchema = UserProfileSchema.nullable();

export function useRiskProfile() {
  const [profile, setStored, reset] = useStoredState(PROFILE_STORAGE_KEY, NullableProfileSchema, null);

  const saveProfile = useCallback((next: UserProfile) => setStored(next), [setStored]);

  return { profile, saveProfile, clearProfile: reset };
}

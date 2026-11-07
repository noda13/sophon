import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROFILE_PRESETS } from '../logic/profilePresets';
import type { UserProfile } from '../logic/profile';
import { PROFILE_STORAGE_KEY, useRiskProfile } from './useRiskProfile';

const profile: UserProfile = { age: 55, sensitivity: 'sensitive', allocation: PROFILE_PRESETS[2]!.allocation };

beforeEach(() => window.localStorage.clear());

describe('useRiskProfile', () => {
  it('保存がなければ null', () => {
    const { result } = renderHook(() => useRiskProfile());
    expect(result.current.profile).toBeNull();
  });

  it('localStorage のキーは旧アプリと同じ econoguard-profile', () => {
    expect(PROFILE_STORAGE_KEY).toBe('econoguard-profile');
  });

  it('旧アプリが保存した値を引き継ぐ', () => {
    window.localStorage.setItem('econoguard-profile', JSON.stringify(profile));
    const { result } = renderHook(() => useRiskProfile());
    expect(result.current.profile).toEqual(profile);
  });

  it('壊れた値や合計が100でない配分は null に戻す', () => {
    window.localStorage.setItem(
      'econoguard-profile',
      JSON.stringify({ ...profile, allocation: { ...profile.allocation, cash: 99 } }),
    );
    expect(renderHook(() => useRiskProfile()).result.current.profile).toBeNull();

    window.localStorage.setItem('econoguard-profile', '{not json');
    expect(renderHook(() => useRiskProfile()).result.current.profile).toBeNull();
  });

  it('saveProfile で保存し、clearProfile で消す', () => {
    const { result } = renderHook(() => useRiskProfile());
    act(() => result.current.saveProfile(profile));
    expect(result.current.profile).toEqual(profile);
    expect(JSON.parse(window.localStorage.getItem('econoguard-profile') ?? 'null')).toEqual(profile);

    act(() => result.current.clearProfile());
    expect(result.current.profile).toBeNull();
    expect(window.localStorage.getItem('econoguard-profile')).toBeNull();
  });
});

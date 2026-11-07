import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../logic/profile';
import { DEFAULT_PROFILE, PROFILE_PRESETS } from '../logic/profilePresets';
import { useProfileDraft } from './useProfileDraft';

const saved: UserProfile = { age: 55, sensitivity: 'relaxed', allocation: PROFILE_PRESETS[2]!.allocation };

describe('useProfileDraft', () => {
  it('保存がなければ既定のプロフィールから始まり、未変更', () => {
    const { result } = renderHook(() => useProfileDraft(null));
    expect(result.current.ageInput).toBe(String(DEFAULT_PROFILE.age));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canSave).toBe(true);
    expect(result.current.saveBlocker).toBeNull();
    expect(result.current.activePreset?.id).toBe('all_country');
  });

  it('保存済みのプロフィールから始まる', () => {
    const { result } = renderHook(() => useProfileDraft(saved));
    expect(result.current.ageInput).toBe('55');
    expect(result.current.sensitivity).toBe('relaxed');
    expect(result.current.toProfile()).toEqual(saved);
  });

  it('年齢が不正だと保存できず toProfile は null', () => {
    const { result } = renderHook(() => useProfileDraft(saved));
    act(() => result.current.setAgeInput('10'));
    expect(result.current.ageValid).toBe(false);
    expect(result.current.canSave).toBe(false);
    expect(result.current.isDirty).toBe(true);
    expect(result.current.toProfile()).toBeNull();
  });

  it('配分の合計が 100 でないと保存できず、理由を返す', () => {
    const { result } = renderHook(() => useProfileDraft(saved));
    act(() => result.current.setAllocationValue('cash', saved.allocation.cash + 7));
    expect(result.current.total).toBe(107);
    expect(result.current.canSave).toBe(false);
    expect(result.current.saveBlocker).toContain('7%超過');
    expect(result.current.activePreset).toBeUndefined();
  });

  it('プリセットを適用すると配分が置き換わり、変更前に戻せば未変更に戻る', () => {
    const { result } = renderHook(() => useProfileDraft(saved));
    act(() => result.current.applyPreset(PROFILE_PRESETS[1]!));
    expect(result.current.activePreset?.id).toBe('sp500');
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.applyPreset(PROFILE_PRESETS[2]!));
    expect(result.current.isDirty).toBe(false);
  });

  it('resetTo で別のプロフィールの内容に差し替える', () => {
    const { result } = renderHook(() => useProfileDraft(null));
    act(() => result.current.setAgeInput('99'));
    act(() => result.current.resetTo(saved));
    expect(result.current.ageInput).toBe('55');
  });
});

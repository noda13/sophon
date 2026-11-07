import { describe, expect, it } from 'vitest';
import { PROFILE_PRESETS, DEFAULT_PROFILE } from './profilePresets';
import {
  allocationEquals,
  allocationTotal,
  describeSaveBlocker,
  findActivePreset,
  parseAge,
} from './profileDraft';

describe('parseAge', () => {
  it.each([
    ['20', 20],
    ['80', 80],
    [' 40 ', 40],
  ])('%j を %d として読む', (raw, expected) => {
    expect(parseAge(raw)).toBe(expected);
  });

  it.each(['', '19', '81', '35.5', '-30', '4e1', '４０', 'abc'])('%j は受け付けない', (raw) => {
    expect(parseAge(raw)).toBeNull();
  });
});

describe('allocation helpers', () => {
  it('プリセットの合計は 100', () => {
    for (const preset of PROFILE_PRESETS) expect(allocationTotal(preset.allocation), preset.id).toBe(100);
  });

  it('同じ配分を検出し、違う配分は区別する', () => {
    expect(allocationEquals(DEFAULT_PROFILE.allocation, { ...DEFAULT_PROFILE.allocation })).toBe(true);
    expect(allocationEquals(DEFAULT_PROFILE.allocation, { ...DEFAULT_PROFILE.allocation, cash: 11 })).toBe(false);
  });

  it('プリセットと一致する配分を見つける', () => {
    expect(findActivePreset(PROFILE_PRESETS[1]!.allocation)?.id).toBe('sp500');
    expect(findActivePreset({ ...PROFILE_PRESETS[1]!.allocation, cash: 0, developed_equity: 100 })).toBeUndefined();
  });
});

describe('describeSaveBlocker', () => {
  it('年齢が不正なら年齢を案内する', () => {
    expect(describeSaveBlocker(false, 100)).toContain('年齢');
  });

  it('合計の過不足を案内する', () => {
    expect(describeSaveBlocker(true, 90)).toContain('あと10%');
    expect(describeSaveBlocker(true, 105)).toContain('5%超過');
  });

  it('保存できるなら null', () => {
    expect(describeSaveBlocker(true, 100)).toBeNull();
  });
});

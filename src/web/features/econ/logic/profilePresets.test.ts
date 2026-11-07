import { describe, expect, it } from 'vitest';
import {
  ASSET_CLASS_COLORS,
  ASSET_CLASS_LABELS,
  DEFAULT_PROFILE,
  PROFILE_PRESETS,
} from './profilePresets';
import { ALLOCATION_KEYS, isValidProfile } from './profileValidation';

describe('PROFILE_PRESETS', () => {
  it('has unique ids and non-empty labels', () => {
    const ids = PROFILE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of PROFILE_PRESETS) {
      expect(preset.label, preset.id).toBeTruthy();
    }
  });

  it.each(PROFILE_PRESETS.map((p) => [p.id, p] as const))(
    'allocation of %s covers every asset class and sums to exactly 100',
    (_id, preset) => {
      expect(Object.keys(preset.allocation).sort()).toEqual([...ALLOCATION_KEYS].sort());
      const sum = ALLOCATION_KEYS.reduce((acc, key) => acc + preset.allocation[key], 0);
      expect(sum).toBe(100);
    },
  );

  it.each(PROFILE_PRESETS.map((p) => [p.id, p] as const))(
    'preset %s is accepted by the profile validator',
    (_id, preset) => {
      expect(isValidProfile({ ...DEFAULT_PROFILE, allocation: preset.allocation })).toBe(true);
    },
  );
});

describe('DEFAULT_PROFILE', () => {
  it('is a valid profile', () => {
    expect(isValidProfile(DEFAULT_PROFILE)).toBe(true);
  });

  it('uses the all-country preset allocation', () => {
    const allCountry = PROFILE_PRESETS.find((p) => p.id === 'all_country');
    expect(DEFAULT_PROFILE.allocation).toEqual(allCountry?.allocation);
  });
});

describe('asset class display tables', () => {
  it('has a label and a hex color for every asset class', () => {
    for (const key of ALLOCATION_KEYS) {
      expect(ASSET_CLASS_LABELS[key], key).toBeTruthy();
      expect(ASSET_CLASS_COLORS[key], key).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(Object.keys(ASSET_CLASS_LABELS).sort()).toEqual([...ALLOCATION_KEYS].sort());
    expect(Object.keys(ASSET_CLASS_COLORS).sort()).toEqual([...ALLOCATION_KEYS].sort());
  });

  it('gives each asset class a distinct chart color', () => {
    const colors = Object.values(ASSET_CLASS_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

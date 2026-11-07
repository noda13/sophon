import { describe, expect, it } from 'vitest';
import { PROFILE_PRESETS } from './profilePresets';
import { isValidProfile } from './profileValidation';

const valid = () => ({
  age: 40,
  sensitivity: 'standard',
  allocation: { ...PROFILE_PRESETS[0].allocation },
});

describe('isValidProfile', () => {
  it('accepts every preset allocation', () => {
    for (const preset of PROFILE_PRESETS) {
      expect(isValidProfile({ ...valid(), allocation: preset.allocation }), preset.id).toBe(true);
    }
  });

  it.each([null, undefined, 'x', 42, []])('rejects non-object %j', (value) => {
    expect(isValidProfile(value)).toBe(false);
  });

  it.each([19, 81, 35.5, NaN, '40'])('rejects age %j', (age) => {
    expect(isValidProfile({ ...valid(), age })).toBe(false);
  });

  it('accepts the age bounds', () => {
    expect(isValidProfile({ ...valid(), age: 20 })).toBe(true);
    expect(isValidProfile({ ...valid(), age: 80 })).toBe(true);
  });

  it('rejects an unknown sensitivity', () => {
    expect(isValidProfile({ ...valid(), sensitivity: 'extreme' })).toBe(false);
  });

  it('rejects an allocation that does not sum to exactly 100', () => {
    const p = valid();
    p.allocation.cash += 1;
    expect(isValidProfile(p)).toBe(false);
    p.allocation.cash -= 2;
    expect(isValidProfile(p)).toBe(false);
  });

  it('rejects a missing, negative or non-numeric allocation value', () => {
    const missing = valid() as Record<string, unknown>;
    missing.allocation = { ...(missing.allocation as object), cash: undefined };
    expect(isValidProfile(missing)).toBe(false);

    const negative = valid();
    negative.allocation.cash = -10;
    negative.allocation.developed_equity += 20;
    expect(isValidProfile(negative)).toBe(false);

    const old = { age: 40, sensitivity: 'standard', allocation: { stocks: 60, bonds: 40 } };
    expect(isValidProfile(old)).toBe(false);
  });
});

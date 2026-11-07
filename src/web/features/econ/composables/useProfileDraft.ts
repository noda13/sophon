import { useCallback, useMemo, useState } from 'react';
import type { AssetAllocation, MonitoringSensitivity, UserProfile } from '../logic/profile';
import {
  allocationEquals,
  allocationTotal,
  describeSaveBlocker,
  findActivePreset,
  parseAge,
} from '../logic/profileDraft';
import { DEFAULT_PROFILE, type ProfilePreset } from '../logic/profilePresets';

interface Draft {
  ageInput: string;
  sensitivity: MonitoringSensitivity;
  allocation: AssetAllocation;
}

function toDraft(source: UserProfile): Draft {
  return { ageInput: String(source.age), sensitivity: source.sensitivity, allocation: { ...source.allocation } };
}

// 編集中の入力。保存されたプロフィールとは別に持ち、保存するまで localStorage には触れない
export function useProfileDraft(saved: UserProfile | null) {
  const base = saved ?? DEFAULT_PROFILE;
  const [draft, setDraft] = useState<Draft>(() => toDraft(base));

  const derived = useMemo(() => {
    const total = allocationTotal(draft.allocation);
    const age = parseAge(draft.ageInput);
    return {
      total,
      age,
      ageValid: age !== null,
      canSave: age !== null && total === 100,
      saveBlocker: describeSaveBlocker(age !== null, total),
      activePreset: findActivePreset(draft.allocation),
      isDirty:
        draft.ageInput !== String(base.age) ||
        draft.sensitivity !== base.sensitivity ||
        !allocationEquals(draft.allocation, base.allocation),
    };
  }, [draft, base]);

  const setAgeInput = useCallback((ageInput: string) => setDraft((d) => ({ ...d, ageInput })), []);
  const setSensitivity = useCallback((sensitivity: MonitoringSensitivity) => setDraft((d) => ({ ...d, sensitivity })), []);
  const setAllocationValue = useCallback(
    (key: keyof AssetAllocation, value: number) =>
      setDraft((d) => ({ ...d, allocation: { ...d.allocation, [key]: value } })),
    [],
  );
  const applyPreset = useCallback(
    (preset: ProfilePreset) => setDraft((d) => ({ ...d, allocation: { ...preset.allocation } })),
    [],
  );
  const resetTo = useCallback((source: UserProfile | null) => setDraft(toDraft(source ?? DEFAULT_PROFILE)), []);

  const toProfile = useCallback((): UserProfile | null => {
    if (derived.age === null || derived.total !== 100) return null;
    return { age: derived.age, sensitivity: draft.sensitivity, allocation: { ...draft.allocation } };
  }, [derived.age, derived.total, draft.sensitivity, draft.allocation]);

  return {
    ageInput: draft.ageInput,
    sensitivity: draft.sensitivity,
    allocation: draft.allocation,
    ...derived,
    setAgeInput,
    setSensitivity,
    setAllocationValue,
    applyPreset,
    resetTo,
    toProfile,
  };
}

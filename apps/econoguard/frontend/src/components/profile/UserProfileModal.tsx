import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { AssetAllocation, MonitoringSensitivity } from '../../lib/types/profile';
import { useUserProfile } from '../../contexts/UserProfileContext';
import {
  PROFILE_PRESETS,
  DEFAULT_PROFILE,
  ASSET_CLASS_LABELS,
} from '../../lib/profilePresets';
import { MIN_AGE, MAX_AGE } from '../../lib/profileValidation';
import { AllocationPieChart } from './AllocationPieChart';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SENSITIVITY_OPTIONS: { value: MonitoringSensitivity; label: string; subtitle: string }[] = [
  { value: 'sensitive', label: '敏感', subtitle: '早めにアラート' },
  { value: 'standard', label: '標準', subtitle: '標準的な閾値' },
  { value: 'relaxed', label: '鈍感', subtitle: '大きな変動のみ' },
];

const TITLE_ID = 'profile-modal-title';
const AGE_ERROR_ID = 'profile-age-error';
const SENSITIVITY_LABEL_ID = 'profile-sensitivity-label';
const SAVE_HINT_ID = 'profile-save-hint';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function allocationEquals(a: AssetAllocation, b: AssetAllocation): boolean {
  return (Object.keys(a) as (keyof AssetAllocation)[]).every((key) => a[key] === b[key]);
}

function allocationTotal(allocation: AssetAllocation): number {
  return (Object.values(allocation) as number[]).reduce((sum, v) => sum + v, 0);
}

function parseAge(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= MIN_AGE && n <= MAX_AGE ? n : null;
}

export function UserProfileModal({ isOpen, onClose }: Props) {
  const { profile, setProfile, clearProfile } = useUserProfile();

  const [ageInput, setAgeInput] = useState(String(DEFAULT_PROFILE.age));
  const [sensitivity, setSensitivity] = useState<MonitoringSensitivity>(DEFAULT_PROFILE.sensitivity);
  const [allocation, setAllocation] = useState<AssetAllocation>(DEFAULT_PROFILE.allocation);

  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayPressStartedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      const source = profile ?? DEFAULT_PROFILE;
      setAgeInput(String(source.age));
      setSensitivity(source.sensitivity);
      setAllocation({ ...source.allocation });
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  const saved = profile ?? DEFAULT_PROFILE;
  const isDirty =
    ageInput !== String(saved.age) ||
    sensitivity !== saved.sensitivity ||
    !allocationEquals(allocation, saved.allocation);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDirty) onClose();
    },
    [onClose, isDirty],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const total = allocationTotal(allocation);
  const parsedAge = parseAge(ageInput);
  const ageValid = parsedAge !== null;
  const canSave = total === 100 && ageValid;
  const activePreset = PROFILE_PRESETS.find((p) => allocationEquals(p.allocation, allocation));
  const diff = 100 - total;
  const saveHint = !ageValid
    ? `年齢を${MIN_AGE}〜${MAX_AGE}の整数で入力すると保存できます`
    : diff > 0
      ? `配分の合計があと${diff}%足りないため保存できません`
      : diff < 0
        ? `配分の合計が${-diff}%超過しているため保存できません`
        : null;

  function handleAllocationChange(key: keyof AssetAllocation, value: number) {
    setAllocation((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (parsedAge === null || total !== 100) return;
    setProfile({ age: parsedAge, sensitivity, allocation });
    onClose();
  }

  function handleClear() {
    clearProfile();
    onClose();
  }

  function handleDialogKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      e.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!dialog.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        overlayPressStartedRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // A slider drag released outside the dialog fires click on the overlay; unsaved edits must survive it.
        const startedOnOverlay = overlayPressStartedRef.current;
        overlayPressStartedRef.current = false;
        if (e.target === e.currentTarget && startedOnOverlay && !isDirty) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
        className="relative w-full max-w-lg mx-4 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 id={TITLE_ID} className="text-lg font-semibold text-gray-100">プロフィール設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto max-h-[80vh] px-6">
          {/* Section 1: 基本情報 */}
          <div className="py-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">基本情報</h3>

            {/* 年齢 */}
            <div className="mb-5">
              <label className="block text-sm text-gray-300 mb-1" htmlFor="profile-age">
                年齢
              </label>
              <input
                id="profile-age"
                type="number"
                inputMode="numeric"
                min={MIN_AGE}
                max={MAX_AGE}
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                aria-invalid={!ageValid}
                aria-describedby={ageValid ? undefined : AGE_ERROR_ID}
                className={`w-24 px-3 py-1.5 rounded-md bg-gray-700 border text-gray-100 text-sm focus:outline-none focus:ring-2 ${
                  ageValid ? 'border-gray-600 focus:ring-blue-500' : 'border-red-500 focus:ring-red-500'
                }`}
              />
              {!ageValid && (
                <p id={AGE_ERROR_ID} role="alert" className="mt-1 text-xs text-red-400">
                  {`年齢は${MIN_AGE}〜${MAX_AGE}の整数で入力してください`}
                </p>
              )}
            </div>

            {/* 監視感度 */}
            <div role="group" aria-labelledby={SENSITIVITY_LABEL_ID}>
              <span id={SENSITIVITY_LABEL_ID} className="block text-sm text-gray-300 mb-2">監視感度</span>
              <div className="flex gap-2">
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSensitivity(opt.value)}
                    aria-pressed={sensitivity === opt.value}
                    className={`flex-1 flex flex-col items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                      sensitivity === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className={`text-xs mt-0.5 ${sensitivity === opt.value ? 'text-blue-200' : 'text-gray-500'}`}>
                      {opt.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: 資産配分 */}
          <div className="border-t border-gray-700 py-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">資産配分</h3>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2 mb-5">
              {PROFILE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setAllocation({ ...preset.allocation })}
                  aria-pressed={activePreset?.id === preset.id}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activePreset?.id === preset.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Asset class sliders */}
            <div className="space-y-3 mb-5">
              {(Object.keys(ASSET_CLASS_LABELS) as (keyof AssetAllocation)[]).map((key) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{ASSET_CLASS_LABELS[key]}</span>
                    <span className="text-sm font-medium text-gray-200 w-12 text-right">
                      {allocation[key]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={allocation[key]}
                    onChange={(e) => handleAllocationChange(key, Number(e.target.value))}
                    aria-label={ASSET_CLASS_LABELS[key]}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-700 accent-blue-500"
                  />
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm text-gray-400">合計</span>
              <span className={`text-sm font-bold ${total === 100 ? 'text-green-400' : 'text-red-400'}`}>
                {total}%{diff !== 0 && `（${diff > 0 ? `あと${diff}%` : `${-diff}%超過`}）`}
              </span>
            </div>

            {/* Pie chart */}
            <div className="flex justify-center">
              <AllocationPieChart allocation={allocation} size={150} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-700 flex-shrink-0 flex-wrap">
          <p
            id={SAVE_HINT_ID}
            role="status"
            className="w-full text-right text-xs text-red-400 empty:hidden"
          >
            {saveHint}
          </p>
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-lg text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            設定をクリア
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            閉じる
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            aria-describedby={saveHint ? SAVE_HINT_ID : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              canSave
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-blue-900 text-blue-400 cursor-not-allowed opacity-50'
            }`}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

import { Dialog } from '../../../ui/Dialog';
import { useProfileDraft } from '../composables/useProfileDraft';
import type { AssetAllocation, MonitoringSensitivity, UserProfile } from '../logic/profile';
import { ASSET_CLASS_LABELS, PROFILE_PRESETS } from '../logic/profilePresets';
import { MAX_AGE, MIN_AGE } from '../logic/profileValidation';
import { AllocationPieChart } from './AllocationPieChart';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  onClear: () => void;
}

const SENSITIVITY_OPTIONS: { value: MonitoringSensitivity; label: string; subtitle: string }[] = [
  { value: 'sensitive', label: '敏感', subtitle: '早めにアラート' },
  { value: 'standard', label: '標準', subtitle: '標準的な閾値' },
  { value: 'relaxed', label: '鈍感', subtitle: '大きな変動のみ' },
];

const ASSET_KEYS = Object.keys(ASSET_CLASS_LABELS) as (keyof AssetAllocation)[];

const UNSAVED_CONFIRM_MESSAGE = '保存していない変更があります。閉じますか？';

const choiceClass = (active: boolean) =>
  active ? 'bg-accent text-surface' : 'bg-surface-raised text-fg-muted hover:bg-surface-overlay hover:text-fg';

// 編集中の値はこのコンポーネントが持つので、誤って閉じても保存するまで残る
export function ProfileDialog({ open, onOpenChange, profile, onSave, onClear }: Props) {
  const draft = useProfileDraft(profile);
  const diff = 100 - draft.total;

  function handleOpenChange(next: boolean) {
    if (!next && draft.isDirty && !window.confirm(UNSAVED_CONFIRM_MESSAGE)) return;
    onOpenChange(next);
  }

  // 保存・クリアは同じ描画の isDirty がまだ古いので、確認を挟まない onOpenChange を直接呼ぶ
  function handleSave() {
    const next = draft.toProfile();
    if (!next) return;
    onSave(next);
    onOpenChange(false);
  }

  function handleClear() {
    onClear();
    draft.resetTo(null);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="プロフィール設定"
      description="年齢・監視感度・資産配分から、あなた向けのリスクを算出します。入力はこのブラウザにだけ保存されます。"
    >
      <div className="space-y-5">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-fg-muted">基本情報</h3>
          <div>
            <label className="mb-1 block text-sm text-fg" htmlFor="profile-age">
              年齢
            </label>
            <input
              id="profile-age"
              type="number"
              inputMode="numeric"
              min={MIN_AGE}
              max={MAX_AGE}
              value={draft.ageInput}
              onChange={(e) => draft.setAgeInput(e.target.value)}
              aria-invalid={!draft.ageValid}
              aria-describedby={draft.ageValid ? undefined : 'profile-age-error'}
              className={`w-24 rounded-md border bg-surface-raised px-3 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 ${
                draft.ageValid ? 'border-border focus:ring-accent' : 'border-danger focus:ring-danger'
              }`}
            />
            {!draft.ageValid && (
              <p id="profile-age-error" role="alert" className="mt-1 text-xs text-danger">
                年齢は{MIN_AGE}〜{MAX_AGE}の整数で入力してください
              </p>
            )}
          </div>

          <div role="group" aria-labelledby="profile-sensitivity-label">
            <span id="profile-sensitivity-label" className="mb-2 block text-sm text-fg">
              監視感度
            </span>
            <div className="flex gap-2">
              {SENSITIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => draft.setSensitivity(opt.value)}
                  aria-pressed={draft.sensitivity === opt.value}
                  className={`flex flex-1 flex-col items-center rounded-lg px-3 py-2 text-sm transition-colors ${choiceClass(draft.sensitivity === opt.value)}`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="mt-0.5 text-xs opacity-80">{opt.subtitle}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-fg-muted">資産配分</h3>
          <div className="flex flex-wrap gap-2">
            {PROFILE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => draft.applyPreset(preset)}
                aria-pressed={draft.activePreset?.id === preset.id}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${choiceClass(draft.activePreset?.id === preset.id)}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {ASSET_KEYS.map((key) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm text-fg">{ASSET_CLASS_LABELS[key]}</span>
                  <span className="w-12 text-right text-sm font-medium text-fg">{draft.allocation[key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft.allocation[key]}
                  onChange={(e) => draft.setAllocationValue(key, Number(e.target.value))}
                  aria-label={ASSET_CLASS_LABELS[key]}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-raised accent-accent"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-muted">合計</span>
            <span className={`text-sm font-bold ${diff === 0 ? 'text-success' : 'text-danger'}`}>
              {draft.total}%{diff !== 0 && `（${diff > 0 ? `あと${diff}%` : `${-diff}%超過`}）`}
            </span>
          </div>

          <AllocationPieChart allocation={draft.allocation} size={150} />
        </section>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <p id="profile-save-hint" role="status" className="w-full text-right text-xs text-danger empty:hidden">
            {draft.saveBlocker}
          </p>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg bg-surface-raised px-4 py-2 text-sm text-fg-muted hover:bg-surface hover:text-fg"
          >
            設定をクリア
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.canSave}
            aria-describedby={draft.saveBlocker ? 'profile-save-hint' : undefined}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            保存
          </button>
        </footer>
      </div>
    </Dialog>
  );
}

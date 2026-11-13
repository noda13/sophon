import { useEffect, useId, useState } from 'react';
import { parseCap, validateCapInputs } from '../logic/capInput';
import { t } from '../logic/i18n';

const FIELD =
  'rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none';

interface CapInputProps {
  label: string;
  draft: string;
  onDraftChange: (text: string) => void;
  invalid: boolean;
  describedBy: string | undefined;
  message: { id: string; text: string } | null;
}

function CapInput({ label, draft, onDraftChange, invalid, describedBy, message }: CapInputProps) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-fg-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${FIELD} w-40 ${invalid ? 'border-danger' : ''}`}
        onChange={(e) => onDraftChange(e.target.value)}
      />
      {message && (
        <p id={message.id} className="mt-1 text-xs text-danger">
          {message.text}
        </p>
      )}
    </div>
  );
}

// 入力途中の「1.」のような文字列を URL の値で上書きしないよう、入力欄の文字列は自前で持つ。
// 解釈できない文字列は URL へ反映せず直前の値を保つので、検証はこの文字列に対して行う
function useCapDraft(value: number | undefined, onChange: (value: number | undefined) => void) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));

  useEffect(() => {
    setDraft((current) => (parseCap(current) === value ? current : value === undefined ? '' : String(value)));
  }, [value]);

  const onDraftChange = (text: string) => {
    setDraft(text);
    const parsed = parseCap(text);
    if (parsed !== null) onChange(parsed);
  };
  return [draft, onDraftChange] as const;
}

interface SectorExcludeProps {
  sectors: readonly string[];
  excluded: readonly string[];
  onChange: (sectors: string[]) => void;
}

function SectorExclude({ sectors, excluded, onChange }: SectorExcludeProps) {
  const toggle = (sector: string, checked: boolean) =>
    onChange(checked ? [...excluded, sector] : excluded.filter((s) => s !== sector));

  return (
    <details className="relative">
      <summary className={`${FIELD} cursor-pointer select-none`}>
        {t('excludeSectorsLabel')}
        <span className="ml-2 text-fg-muted">
          {excluded.length > 0 ? `${excluded.length}` : t('excludeSectorsNone')}
        </span>
      </summary>
      <ul className="absolute z-40 mt-1 grid max-h-72 w-72 gap-0.5 overflow-y-auto rounded-md border border-border bg-surface-overlay p-2 shadow-xl">
        {sectors.map((sector) => (
          <li key={sector}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent-muted">
              <input
                type="checkbox"
                checked={excluded.includes(sector)}
                onChange={(e) => toggle(sector, e.target.checked)}
              />
              {sector}
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface RankingFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  minCap: number | undefined;
  maxCap: number | undefined;
  onMinCapChange: (value: number | undefined) => void;
  onMaxCapChange: (value: number | undefined) => void;
  sectors: readonly string[];
  excludedSectors: readonly string[];
  onExcludedSectorsChange: (sectors: string[]) => void;
  hasFilter: boolean;
  onReset: () => void;
}

export function RankingFilters(props: RankingFiltersProps) {
  const searchId = useId();
  const [minDraft, onMinDraftChange] = useCapDraft(props.minCap, props.onMinCapChange);
  const [maxDraft, onMaxDraftChange] = useCapDraft(props.maxCap, props.onMaxCapChange);
  const validation = validateCapInputs(minDraft, maxDraft);
  const minInvalidId = `${searchId}-min-invalid`;
  const maxInvalidId = `${searchId}-max-invalid`;
  const reversedId = `${searchId}-reversed`;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={searchId} className="mb-1 block text-xs text-fg-muted">
          {t('searchLabel')}
        </label>
        <input
          id={searchId}
          type="search"
          value={props.query}
          className={`${FIELD} w-56`}
          onChange={(e) => props.onQueryChange(e.target.value)}
        />
      </div>
      <CapInput
        label={t('minMarketCapLabel')}
        draft={minDraft}
        onDraftChange={onMinDraftChange}
        invalid={validation.minInvalid || validation.reversed}
        describedBy={validation.minInvalid ? minInvalidId : validation.reversed ? reversedId : undefined}
        message={validation.minInvalid ? { id: minInvalidId, text: t('capInvalid') } : null}
      />
      <CapInput
        label={t('maxMarketCapLabel')}
        draft={maxDraft}
        onDraftChange={onMaxDraftChange}
        invalid={validation.maxInvalid || validation.reversed}
        describedBy={validation.maxInvalid ? maxInvalidId : validation.reversed ? reversedId : undefined}
        message={
          validation.maxInvalid
            ? { id: maxInvalidId, text: t('capInvalid') }
            : validation.reversed
              ? { id: reversedId, text: t('capReversed') }
              : null
        }
      />
      <SectorExclude
        sectors={props.sectors}
        excluded={props.excludedSectors}
        onChange={props.onExcludedSectorsChange}
      />
      {props.hasFilter && (
        <button type="button" onClick={props.onReset} className="px-2 py-1.5 text-sm text-accent hover:underline">
          {t('resetFilters')}
        </button>
      )}
    </div>
  );
}

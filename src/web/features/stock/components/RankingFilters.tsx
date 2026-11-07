import { useEffect, useId, useState } from 'react';
import { t } from '../logic/i18n';

const FIELD =
  'rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle hover:border-border-strong focus:border-accent focus:outline-none';

function parseCap(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

interface CapInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

// 入力途中の「1.」のような文字列を URL の値で上書きしないよう、入力欄の文字列は自前で持つ
function CapInput({ label, value, onChange }: CapInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));

  useEffect(() => {
    setDraft((current) => (parseCap(current) === value ? current : value === undefined ? '' : String(value)));
  }, [value]);

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
        className={`${FIELD} w-40`}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseCap(e.target.value);
          if (parsed !== null) onChange(parsed);
        }}
      />
    </div>
  );
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
      <CapInput label={t('minMarketCapLabel')} value={props.minCap} onChange={props.onMinCapChange} />
      <CapInput label={t('maxMarketCapLabel')} value={props.maxCap} onChange={props.onMaxCapChange} />
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

import type { CSSProperties } from 'react';
import type { IssueCategory } from '../../../../shared/schema/issue';
import type { ScoreTone } from '../../../ui/ScoreBadge';
import { Card } from '../../../ui/Card';
import type { HeatmapCell } from '../logic/heatmap';

interface CategoryHeatmapProps {
  cells: readonly HeatmapCell[];
  selected?: IssueCategory | 'none' | undefined;
  onSelect: (category: IssueCategory | undefined) => void;
}

const TONE_TEXT: Record<ScoreTone, string> = {
  low: 'text-risk-low',
  moderate: 'text-risk-moderate',
  high: 'text-risk-high',
  critical: 'text-risk-critical',
};

const TONE_VAR: Record<ScoreTone, string> = {
  low: 'var(--color-risk-low)',
  moderate: 'var(--color-risk-moderate)',
  high: 'var(--color-risk-high)',
  critical: 'var(--color-risk-critical)',
};

const MIN_TINT_PERCENT = 6;
const MAX_TINT_PERCENT = 34;

// 色相は深刻度、濃さは件数で表す。0 件のセルは地の色のままにする
function cellStyle(cell: HeatmapCell): CSSProperties {
  if (cell.count === 0) return {};
  const percent = Math.round(MIN_TINT_PERCENT + cell.intensity * (MAX_TINT_PERCENT - MIN_TINT_PERCENT));
  return {
    backgroundColor: `color-mix(in srgb, ${TONE_VAR[cell.severityTone]} ${percent}%, var(--color-surface-raised))`,
  };
}

export function CategoryHeatmap({ cells, selected, onSelect }: CategoryHeatmapProps) {
  return (
    <Card title="カテゴリ別ヒートマップ">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cells.map((cell) => {
          const isSelected = selected === cell.category;
          return (
            <button
              key={cell.category}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? undefined : cell.category)}
              style={cellStyle(cell)}
              className={`rounded-lg border p-3 text-left transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isSelected ? 'border-accent ring-1 ring-accent' : 'border-border'
              }`}
            >
              <p className="mb-1 text-xs font-semibold leading-tight text-fg">{cell.label}</p>
              <p className="mb-2 text-2xl font-bold tabular-nums text-fg">{cell.count}</p>
              <dl className="space-y-0.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-fg-muted">深刻度</dt>
                  <dd className={`font-medium tabular-nums ${TONE_TEXT[cell.severityTone]}`}>
                    {Math.round(cell.avgSeverity)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-fg-muted">アプリ化</dt>
                  <dd className={`font-medium tabular-nums ${TONE_TEXT[cell.appifiabilityTone]}`}>
                    {Math.round(cell.avgAppifiability)}
                  </dd>
                </div>
              </dl>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import type { EconomicIndicator } from '../../../../shared/schema/econ';
import { isIndicatorStale } from '../logic/dashboard';
import { formatChange, formatNumber } from '../logic/formatters';

interface Props {
  indicators: readonly EconomicIndicator[];
  relevanceFor: (code: string) => 'high' | 'medium' | 'low' | null;
  isError?: boolean;
  now?: number;
}

const CHANGE_CLASS = {
  up: 'text-danger',
  down: 'text-success',
  flat: 'text-fg-muted',
} as const;

export function IndicatorPanel({ indicators, relevanceFor, isError = false, now }: Props) {
  return (
    <section aria-label="経済指標">
      <h2 className="mb-3 text-lg font-semibold text-fg">経済指標</h2>
      {isError ? (
        <ErrorBox message="経済指標データの取得に失敗しました。" />
      ) : indicators.length === 0 ? (
        <EmptyState title="経済指標データがありません" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {indicators.map((ind) => {
            const change = formatChange(ind.value, ind.previousValue);
            return (
              <div key={ind.code} className="rounded-lg border border-border bg-surface-raised p-3">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-fg-subtle">{ind.name}</span>
                  {relevanceFor(ind.code) === 'high' && (
                    <span className="rounded bg-info-muted px-1.5 text-[10px] font-medium text-info">注目</span>
                  )}
                  {isIndicatorStale(ind, now) && (
                    <span className="rounded bg-warning-muted px-1.5 text-[10px] font-medium text-warning">更新停止</span>
                  )}
                </div>
                <div className="text-lg font-bold text-fg">
                  {formatNumber(ind.value)}
                  {ind.unit && <span className="ml-1 text-xs text-fg-subtle">{ind.unit}</span>}
                </div>
                {change && <div className={`text-xs ${CHANGE_CLASS[change.direction]}`}>{change.text}</div>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

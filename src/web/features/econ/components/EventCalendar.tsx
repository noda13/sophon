import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import type { EconomicEvent } from '../../../../shared/schema/econ';
import { upcomingEvents } from '../logic/dashboard';

const REGION_LABEL: Record<EconomicEvent['region'], string> = {
  US: 'US',
  JP: 'JP',
  EU: 'EU',
  GLOBAL: '全世界',
};

function formatEventDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

function DaysLabel({ days }: { days: number }) {
  if (days === 0) return <span className="rounded bg-info-muted px-1.5 py-0.5 text-xs font-medium text-info">今日</span>;
  if (days === 1) return <span className="rounded bg-info-muted px-1.5 py-0.5 text-xs text-info">明日</span>;
  return <span className="text-xs text-fg-subtle">{days}日後</span>;
}

interface Props {
  events: readonly EconomicEvent[];
  isError?: boolean;
  now?: Date;
}

export function EventCalendar({ events, isError = false, now }: Props) {
  const upcoming = upcomingEvents(events, now);

  return (
    <section aria-label="今後の注目イベント">
      <h2 className="mb-3 text-lg font-semibold text-fg">今後の注目イベント</h2>
      {isError ? (
        <ErrorBox message="イベントの取得に失敗しました。" />
      ) : upcoming.length === 0 ? (
        <EmptyState title="直近の注目イベントはありません。" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {upcoming.map(({ event, days }) => (
            <li
              key={`${event.date}-${event.titleJa}`}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-3"
            >
              <span className="mt-0.5 w-12 shrink-0 rounded bg-surface-overlay px-1 py-0.5 text-center text-[10px] font-medium text-fg-muted">
                {REGION_LABEL[event.region]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="text-xs text-fg-muted">{formatEventDate(event.date)}</span>
                  <DaysLabel days={days} />
                  <span
                    role="img"
                    aria-label={event.importance === 'high' ? '重要度: 高' : '重要度: 中'}
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${event.importance === 'high' ? 'bg-danger' : 'bg-warning'}`}
                  />
                </div>
                <p className="text-sm leading-tight text-fg">{event.titleJa}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

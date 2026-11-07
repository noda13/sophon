import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from '../../services/api';
import type { EconomicEvent } from '../../services/api';

const REGION_EMOJI: Record<EconomicEvent['region'], string> = {
  US: '🇺🇸',
  JP: '🇯🇵',
  EU: '🇪🇺',
  GLOBAL: '🌐',
};

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DaysLabel({ days }: { days: number }) {
  if (days === 0) return <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400 font-medium">今日</span>;
  if (days === 1) return <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">明日</span>;
  return <span className="text-xs text-gray-500">{days}日後</span>;
}

export function EventCalendar() {
  const { data: events, isError } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
  });

  const upcoming = (events ?? [])
    .map((event) => ({ event, days: daysUntil(event.date) }))
    .filter(({ days }) => days >= 0);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">📅 今後の注目イベント</h2>
      {isError ? (
        <p className="text-sm text-red-400">イベントの取得に失敗しました。</p>
      ) : upcoming.length === 0 ? (
        <p className="text-sm text-gray-500">直近30日の注目イベントはありません。</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcoming.map(({ event, days }, i) => (
            <div key={`${event.date}-${i}`} className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-start gap-3">
              <div className="text-xl leading-none mt-0.5">{REGION_EMOJI[event.region]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-gray-400">{formatEventDate(event.date)}</span>
                  <DaysLabel days={days} />
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    event.importance === 'high' ? 'bg-red-400' : 'bg-yellow-400'
                  }`} />
                </div>
                <p className="text-sm text-gray-200 leading-tight">{event.titleJa}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

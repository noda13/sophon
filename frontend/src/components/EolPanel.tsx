import type { EolItem } from '../services/api';
import { EOL_NO_DATE_DAYS } from '../lib/categories';

interface Props {
  items: EolItem[];
}

function getEolStyle(daysLeft: number): { card: string; badge: string; label: string } {
  if (daysLeft >= EOL_NO_DATE_DAYS) {
    return {
      card: 'bg-gray-900 border-gray-700',
      badge: 'bg-gray-800 text-gray-400 border-gray-700',
      label: 'EOL未定',
    };
  }
  if (daysLeft < 0) {
    return {
      card: 'bg-gray-900 border-gray-700',
      badge: 'bg-gray-800 text-gray-500 border-gray-700',
      label: 'EOL済',
    };
  }
  if (daysLeft < 90) {
    return {
      card: 'bg-red-950 border-red-800',
      badge: 'bg-red-900 text-red-300 border-red-700',
      label: `残${daysLeft}日`,
    };
  }
  if (daysLeft < 180) {
    return {
      card: 'bg-yellow-950 border-yellow-800',
      badge: 'bg-yellow-900 text-yellow-300 border-yellow-700',
      label: `残${daysLeft}日`,
    };
  }
  return {
    card: 'bg-green-950 border-green-900',
    badge: 'bg-green-900 text-green-300 border-green-800',
    label: `残${daysLeft}日`,
  };
}

function formatEolDate(eol: string | false): string {
  if (eol === false) return '—';
  return eol;
}

export function EolPanel({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        EOL情報がありません
      </div>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        EOL / サポート期限
      </h2>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {items.map((item, idx) => {
            const { card, badge, label } = getEolStyle(item.daysLeft);
            return (
              <div
                key={`${item.product}-${item.cycle}-${idx}`}
                className={`rounded-lg border px-4 py-3 min-w-[160px] flex-shrink-0 ${card}`}
              >
                <div className="text-sm font-semibold text-gray-100 truncate">
                  {item.product}
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  {item.cycle}
                  {item.latest && (
                    <span className="ml-1 text-gray-500">({item.latest})</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  EOL: {formatEolDate(item.eol)}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${badge}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { CATEGORIES, CATEGORY_META } from '../lib/categories';
import type { Category } from '../lib/categories';

type TabValue = Category | 'all';

interface Props {
  selected: TabValue;
  onChange: (c: TabValue) => void;
}

const ACTIVE_COLOR_STYLES: Record<string, string> = {
  blue:   'bg-blue-800 text-blue-200 border-blue-600',
  purple: 'bg-purple-800 text-purple-200 border-purple-600',
  red:    'bg-red-800 text-red-200 border-red-600',
  green:  'bg-green-800 text-green-200 border-green-600',
  all:    'bg-gray-700 text-white border-gray-500',
};

export function CategoryTabs({ selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {/* "すべて" tab */}
      <button
        onClick={() => onChange('all')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
          selected === 'all'
            ? ACTIVE_COLOR_STYLES['all']
            : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
        }`}
      >
        すべて
      </button>

      {/* Category tabs */}
      {CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const isActive = selected === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              isActive
                ? ACTIVE_COLOR_STYLES[meta.color]
                : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
            }`}
            title={meta.description}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

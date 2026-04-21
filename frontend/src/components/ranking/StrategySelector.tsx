import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchStrategies } from '../../services/api';
import type { StrategyMeta } from '../../lib/types';

export function StrategySelector() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStrategy = searchParams.get('strategy') ?? 'kiyohara';

  const { data: strategies, isLoading } = useQuery<StrategyMeta[]>({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
    staleTime: 10 * 60 * 1000,
  });

  const active = strategies?.filter(s => s.active) ?? [];

  if (isLoading || active.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">視点:</span>
        <span className="px-3 py-1 bg-blue-700 text-blue-100 rounded text-sm">清原流</span>
      </div>
    );
  }

  if (active.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">視点:</span>
        <span
          className="px-3 py-1 bg-blue-700 text-blue-100 rounded text-sm cursor-default"
          title={active[0].description}
        >
          {active[0].displayName}
        </span>
      </div>
    );
  }

  // Future: multiple strategies — show as tabs
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-sm">視点:</span>
      <div className="flex gap-1">
        {active.map(s => (
          <button
            key={s.id}
            onClick={() => setSearchParams({ strategy: s.id })}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              currentStrategy === s.id
                ? 'bg-blue-700 text-blue-100'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={s.description}
          >
            {s.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}

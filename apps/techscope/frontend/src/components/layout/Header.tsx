import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMeta } from '../../services/api';

export function Header() {
  const { data: meta } = useQuery({
    queryKey: ['meta'],
    queryFn: fetchMeta,
  });

  const lastUpdated = meta?.lastUpdated
    ? new Date(meta.lastUpdated).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-white tracking-tight">
            🔭 techscope
          </span>
          {lastUpdated && (
            <span className="hidden sm:block text-xs text-gray-500">
              更新: {lastUpdated}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            ダッシュボード
          </NavLink>
          <NavLink
            to="/digest"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            ダイジェスト
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

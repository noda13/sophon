import { Link, useLocation } from 'react-router-dom';
import { useMeta } from '../../hooks/useIssues';
import { formatDate } from '../../lib/formatters';

export default function Header() {
  const { data: meta } = useMeta();
  const location = useLocation();

  const navLinkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      location.pathname === path
        ? 'bg-gray-700 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <header className="bg-gray-900 text-white shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">
                Issue Radar
              </span>
              <span className="hidden text-xs text-gray-400 sm:block">
                社会課題収集・分析ダッシュボード
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link to="/" className={navLinkClass('/')}>
                ダッシュボード
              </Link>
              <Link to="/ideas" className={navLinkClass('/ideas')}>
                解決アイデア
              </Link>
            </nav>
          </div>

          {meta?.lastUpdated && (
            <div className="hidden text-xs text-gray-400 sm:block">
              最終更新: {formatDate(meta.lastUpdated)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

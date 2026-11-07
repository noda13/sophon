import type { QueryClient } from '@tanstack/react-query';
import { Link, createRootRouteWithContext } from '@tanstack/react-router';
import { AppLayout } from '../layout/AppLayout';
import type { NavItem } from '../layout/AppLayout';
import { EmptyState } from '../ui/EmptyState';

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'ホーム' },
  { to: '/stock', label: 'stock' },
  { to: '/tech', label: 'tech' },
  { to: '/issue', label: 'issue' },
  { to: '/econ', label: 'econ' },
];

function NotFound() {
  return (
    <div className="space-y-4">
      <EmptyState title="ページが見つかりません" description="URL を確認するか、ホームから探し直してください。" />
      <p className="text-center">
        <Link to="/" className="text-sm text-accent hover:underline">
          ホームへ戻る
        </Link>
      </p>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <AppLayout siteName="sophon" navItems={NAV_ITEMS} />,
  notFoundComponent: NotFound,
});

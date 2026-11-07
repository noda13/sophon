import { Link, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface NavItem {
  to: string;
  label: string;
}

interface AppLayoutProps {
  siteName: string;
  navItems: readonly NavItem[];
  footerSlot?: ReactNode;
}

export function AppLayout({ siteName, navItems, footerSlot }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-fg">
      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-fg">
            {siteName}
          </Link>
          <nav aria-label="メインナビゲーション" className="-mx-1 flex flex-wrap gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                // ルートが揃う前でも使えるよう to を string で受ける。この層だけ型付きの `to` を緩める
                to={item.to as string & {}}
                activeOptions={{ exact: item.to === '/' }}
                className="rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
                activeProps={{ className: 'bg-accent-muted text-fg', 'aria-current': 'page' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      {footerSlot && (
        <footer className="border-t border-border bg-surface-raised">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-4">{footerSlot}</div>
        </footer>
      )}
    </div>
  );
}

import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AppLayout } from './AppLayout';

afterEach(cleanup);

describe('AppLayout', () => {
  it('ナビ、本文、フッターを描き、現在のルートを強調する', async () => {
    const root = createRootRoute({
      component: () => <AppLayout siteName="sophon" navItems={[{ to: '/', label: 'ホーム' }, { to: '/stock', label: 'stock' }]} footerSlot={<span>更新枠</span>} />,
    });
    const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <p>home</p> });
    const stock = createRoute({ getParentRoute: () => root, path: '/stock', component: () => <p>stock page</p> });
    const router = createRouter({
      routeTree: root.addChildren([index, stock]),
      history: createMemoryHistory({ initialEntries: ['/stock'] }),
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('stock page')).toBeTruthy();
    expect(screen.getByText('更新枠')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'stock' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'ホーム' }).getAttribute('aria-current')).toBeNull();
  });
});

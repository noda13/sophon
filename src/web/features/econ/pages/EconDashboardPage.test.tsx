import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { econHandlers } from '../composables/econ.testutil';
import { PROFILE_PRESETS } from '../logic/profilePresets';
import { EconDashboardPage } from './EconDashboardPage';

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // recharts の ResponsiveContainer が使う
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

async function renderPage() {
  const rootRoute = createRootRoute();
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/econ', component: EconDashboardPage });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/econ'] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: 'Econoguard' });
}

describe('EconDashboardPage', () => {
  it('実データで主要セクションと免責を描く', async () => {
    server.use(...econHandlers());
    await renderPage();

    expect(await screen.findByRole('region', { name: '総合リスク指数' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'リスク評価' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '経済指標' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '今後の注目イベント' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '注目ニュース' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'リスク推移' })).toBeTruthy();
    expect(screen.getByText(/投資助言ではありません/)).toBeTruthy();
    expect(screen.getByText(/更新$/)).toBeTruthy();
    expect(screen.getByText('データが古い可能性があります')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'ポートフォリオへの影響' })).toBeNull();
  });

  it('プロフィールが保存されていれば個人化の表示が出る', async () => {
    window.localStorage.setItem(
      'econoguard-profile',
      JSON.stringify({ age: 50, sensitivity: 'sensitive', allocation: PROFILE_PRESETS[0]!.allocation }),
    );
    server.use(...econHandlers());
    await renderPage();

    expect(await screen.findByText('あなたのリスク:')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'ポートフォリオへの影響' })).toBeTruthy();
    expect(screen.getAllByText(/あなたへの影響/).length).toBeGreaterThan(0);
  });

  it('リスク評価が取れないとエラーを出し、他のセクションを出さない', async () => {
    server.use(...econHandlers({ 'risks.json': new HttpResponse(null, { status: 500 }) }));
    await renderPage();

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('リスクデータの取得に失敗しました'))).toBe(true);
    expect(screen.queryByRole('region', { name: '経済指標' })).toBeNull();
  });

  it('events だけ失敗してもほかは描き、そのセクションにエラーを出す', async () => {
    server.use(...econHandlers({ 'events.json': new HttpResponse(null, { status: 500 }) }));
    await renderPage();

    const events = await screen.findByRole('region', { name: '今後の注目イベント' });
    await waitFor(() => expect(within(events).getByRole('alert').textContent).toContain('イベントの取得に失敗'));
    expect(screen.getByRole('region', { name: 'リスク評価' })).toBeTruthy();
  });

  it('プロフィールを開いて保存すると localStorage に書かれ、個人化が出る', async () => {
    server.use(...econHandlers());
    await renderPage();
    await screen.findByRole('region', { name: '総合リスク指数' });

    fireEvent.click(screen.getByRole('button', { name: 'プロフィール設定' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    await waitFor(() => expect(window.localStorage.getItem('econoguard-profile')).not.toBeNull());
    expect(JSON.parse(window.localStorage.getItem('econoguard-profile') ?? '{}').age).toBe(40);
    expect(await screen.findByText('あなたのリスク:')).toBeTruthy();
  });
});

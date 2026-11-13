import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { routeTree } from '../../routeTree.gen';
import { makeQueryClient } from '../stock/stock.testutil';

beforeAll(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function meta(source: string, counts: Record<string, number>, generatedAt = new Date().toISOString()) {
  return { source, generatedAt, run: { status: 'ok', counts, errors: [] } };
}

function stubFetch(handler: (url: string) => unknown | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      const body = handler(url);
      return body === null ? new Response(null, { status: 404 }) : Response.json(body);
    }),
  );
}

function renderHome() {
  const queryClient = makeQueryClient();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { queryClient },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('/', () => {
  it('各 source の鮮度バッジと件数の要約を出す', async () => {
    stubFetch((url) => {
      if (url.endsWith('/data/stock/meta.json')) return meta('stock', { stocks: 3800, rankings: 3 });
      if (url.endsWith('/data/tech/meta.json')) return meta('tech', { articles: 40, newArticles: 0 });
      if (url.endsWith('/data/issue/meta.json')) return meta('issue', { issues: 120, ideas: 7 });
      return null;
    });
    renderHome();

    const stock = (await screen.findByRole('link', { name: /戦略別の銘柄ランキング/ })) as HTMLElement;
    expect(await within(stock).findByText(/更新/)).toBeTruthy();
    expect(within(stock).getByText('銘柄').nextSibling?.textContent).toBe('3800');
    expect(within(stock).getByText('ランキング').nextSibling?.textContent).toBe('3');

    const tech = screen.getByRole('link', { name: /技術記事とダイジェスト/ });
    expect(await within(tech).findByText('記事')).toBeTruthy();
    expect(within(tech).queryByText('新着')).toBeNull();

    const issue = screen.getByRole('link', { name: /課題とアイデア/ });
    expect(await within(issue).findByText('アイデア')).toBeTruthy();
  });

  it('meta.json が 404 でもリンクは残り、バッジと要約は出ない', async () => {
    stubFetch(() => null);
    renderHome();

    const stock = (await screen.findByRole('link', { name: /戦略別の銘柄ランキング/ })) as HTMLElement;
    expect(stock.getAttribute('href')).toBe('/stock');
    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(4));
    expect(screen.queryByText(/更新/)).toBeNull();
    expect(within(stock).queryByRole('definition')).toBeNull();
    expect(screen.getByRole('link', { name: /グローバル経済リスクモニター/ }).getAttribute('href')).toBe('/econ');
  });
});

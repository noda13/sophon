import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { act, render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { type ListSearch, useListSearch } from './useListSearch';

const Schema = z.object({
  tab: z.enum(['all', 'new']).catch('all'),
  q: z.string().optional(),
  page: z.number().int().min(1).optional(),
});
type Search = z.output<typeof Schema>;

// jsdom 未実装の window.scrollTo を、ルーターの遷移時のスクロール復元が呼ぶ
beforeAll(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

function setup(initialUrl: string) {
  let latest: ListSearch<Search> | undefined;
  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/list',
    validateSearch: Schema,
    component: function List() {
      latest = useListSearch(listRoute, Schema);
      return null;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
  render(<RouterProvider router={router} />);
  return {
    router,
    get hook() {
      if (!latest) throw new Error('not rendered');
      return latest;
    },
  };
}

describe('useListSearch', () => {
  it('URL の search を検証して返す', async () => {
    const t = setup('/list?tab=new&q=abc&page=2');
    await waitFor(() => expect(t.hook.search).toEqual({ tab: 'new', q: 'abc', page: 2 }));
  });

  it('不正な値は route のスキーマの既定値に落ちる', async () => {
    const t = setup('/list?tab=bogus');
    await waitFor(() => expect(t.hook.search.tab).toBe('all'));
  });

  it('setSearch は一部だけを更新し、他の条件を保つ', async () => {
    const t = setup('/list?tab=new&q=abc');
    await waitFor(() => expect(t.hook.search.q).toBe('abc'));

    act(() => t.hook.setSearch({ page: 3 }));
    await waitFor(() => expect(t.hook.search).toEqual({ tab: 'new', q: 'abc', page: 3 }));
    expect(t.router.state.location.search).toEqual({ tab: 'new', q: 'abc', page: 3 });
  });

  it('undefined を渡すとその条件が URL から消える', async () => {
    const t = setup('/list?tab=new&q=abc');
    await waitFor(() => expect(t.hook.search.q).toBe('abc'));

    act(() => t.hook.setSearch({ q: undefined }));
    await waitFor(() => expect(t.hook.search.q).toBeUndefined());
    expect(t.router.state.location.searchStr).not.toContain('q=');
  });

  it('履歴を積まずに置き換える', async () => {
    const t = setup('/list?q=a');
    await waitFor(() => expect(t.hook.search.q).toBe('a'));
    const before = t.router.history.length;

    act(() => t.hook.setSearch({ q: 'ab' }));
    await waitFor(() => expect(t.hook.search.q).toBe('ab'));
    expect(t.router.history.length).toBe(before);
  });

  it('resetSearch で既定値に戻る', async () => {
    const t = setup('/list?tab=new&q=abc&page=2');
    await waitFor(() => expect(t.hook.search.page).toBe(2));

    act(() => t.hook.resetSearch());
    await waitFor(() => expect(t.hook.search).toEqual({ tab: 'all' }));
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeAll, vi } from 'vitest';
import type { z } from 'zod';
import type { Article } from '../../../shared/schema/tech';

// jsdom 未実装の window.scrollTo を、ルーターの遷移時のスクロール復元が呼ぶ
export function stubScrollTo() {
  beforeAll(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
}

export const article = (id: string, over: Partial<Article> = {}): Article => ({
  id,
  source: 'hackernews',
  category: 'trend',
  importance: '中',
  originalTitle: `Title ${id}`,
  originalUrl: `https://e.com/${id}`,
  publishedAt: '2026-11-01T00:00:00.000Z',
  summaryJa: `要約 ${id}`,
  ...over,
});

export function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

interface RenderRouteOptions<S extends z.ZodType> {
  url: string;
  schema: S;
  // route は createRoute の戻り値。composable やページに渡す
  component: (route: any) => ReactNode;
  client?: QueryClient;
}

export function renderRoute<S extends z.ZodType>({ url, schema, component, client = newQueryClient() }: RenderRouteOptions<S>) {
  const rootRoute = createRootRoute();
  const route: any = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tech',
    validateSearch: schema as z.ZodType<Record<string, unknown>>,
    component: () => component(route),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client, ...view };
}

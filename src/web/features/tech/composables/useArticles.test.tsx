import { act, cleanup, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { articlesSearchSchema } from '../search';
import { article, renderRoute, stubScrollTo } from '../testutil';
import { ARTICLES_PAGE_SIZE, useArticles } from './useArticles';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
stubScrollTo();

const many = Array.from({ length: 45 }, (_, i) => article(`n${i}`, { category: i % 3 === 0 ? 'ai' : 'trend' }));
const articles = [...many, article('blank', { summaryJa: '' })];

function setup(url: string) {
  server.use(http.get('*/data/tech/articles.json', () => HttpResponse.json(articles)));
  let latest: ReturnType<typeof useArticles> | undefined;
  const t = renderRoute({
    url,
    schema: articlesSearchSchema,
    component: (route) => {
      latest = useArticles(route);
      return null;
    },
  });
  return {
    ...t,
    get hook() {
      if (!latest) throw new Error('not rendered');
      return latest;
    },
  };
}

describe('useArticles', () => {
  it('要約済みの記事を1ページ分だけ返す', async () => {
    const t = setup('/tech');
    await waitFor(() => expect(t.hook.isPending).toBe(false));
    expect(t.hook.articles).toHaveLength(ARTICLES_PAGE_SIZE);
    expect(t.hook.totalCount).toBe(45);
    expect(t.hook.category).toBe('all');
    expect(t.hook.isFiltered).toBe(false);
  });

  it('URL の category、q、page で絞り込む', async () => {
    const t = setup('/tech?category=ai&q=n3&page=1');
    await waitFor(() => expect(t.hook.isPending).toBe(false));
    expect(t.hook.category).toBe('ai');
    expect(t.hook.articles.map((a) => a.id)).toEqual(['n3', 'n30', 'n33', 'n36', 'n39']);
    expect(t.hook.isFiltered).toBe(true);
  });

  it('不正な category は未指定として扱う', async () => {
    const t = setup('/tech?category=nope');
    await waitFor(() => expect(t.hook.isPending).toBe(false));
    expect(t.hook.category).toBe('all');
  });

  it('setCategory は URL を更新してページを 1 に戻す', async () => {
    const t = setup('/tech?page=2');
    await waitFor(() => expect(t.hook.page).toBe(2));

    act(() => t.hook.setCategory('ai'));
    await waitFor(() => expect(t.hook.category).toBe('ai'));
    expect(t.router.state.location.search).toEqual({ category: 'ai' });

    act(() => t.hook.setCategory('all'));
    await waitFor(() => expect(t.hook.category).toBe('all'));
    expect(t.router.state.location.search).toEqual({});
  });

  it('setQuery と setPage は URL に反映され、既定値は URL に出ない', async () => {
    const t = setup('/tech');
    await waitFor(() => expect(t.hook.isPending).toBe(false));

    act(() => t.hook.setPage(3));
    await waitFor(() => expect(t.hook.page).toBe(3));
    expect(t.hook.articles).toHaveLength(5);

    act(() => t.hook.setQuery('n1'));
    await waitFor(() => expect(t.hook.q).toBe('n1'));
    expect(t.router.state.location.search).toEqual({ q: 'n1' });

    act(() => t.hook.setPage(1));
    await waitFor(() => expect(t.router.state.location.search).toEqual({ q: 'n1' }));
  });

  it('取得に失敗すると error を返す', async () => {
    server.use(http.get('*/data/tech/articles.json', () => new HttpResponse(null, { status: 500 })));
    let latest: ReturnType<typeof useArticles> | undefined;
    renderRoute({
      url: '/tech',
      schema: articlesSearchSchema,
      component: (route) => {
        latest = useArticles(route);
        return null;
      },
    });
    await waitFor(() => expect(latest?.error).toBeInstanceOf(Error));
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, type JsonBodyType, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readLegacyJson } from '../../../../shared/schema/legacy-data.testutil';
import type { ListSearch } from '../../../composables/useListSearch';
import { makeIdea, makeIssue } from '../logic/fixtures.testutil';
import type { IdeasSearch, IssuesSearch } from '../logic/search';
import { useCategorySummary, useIssueFreshness } from './useCategorySummary';
import { useIdea, useIdeas, useTopIdeas } from './useIdeas';
import { useIssue, useIssues } from './useIssues';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function listSearch<T extends Record<string, unknown>>(search: T) {
  const setSearch = vi.fn();
  const resetSearch = vi.fn();
  const value: ListSearch<T> = { search, setSearch, resetSearch };
  return { value, setSearch, resetSearch };
}

const serveIssues = (data: JsonBodyType) =>
  server.use(http.get('*/data/issue/issues.json', () => HttpResponse.json(data)));
const serveIdeas = (data: JsonBodyType) =>
  server.use(http.get('*/data/issue/ideas.json', () => HttpResponse.json(data)));

describe('useIssues', () => {
  const issues = [
    makeIssue({ id: 'a', category: 'education', severityScore: 40, publishedAt: '2026-11-01T00:00:00Z' }),
    makeIssue({ id: 'b', category: 'governance', severityScore: 90, publishedAt: '2026-11-02T00:00:00Z' }),
    makeIssue({ id: 'c', category: 'education', severityScore: 70, publishedAt: '2026-11-03T00:00:00Z' }),
  ];

  it('既定は新着順で全件', async () => {
    serveIssues(issues);
    const { value } = listSearch<IssuesSearch>({});
    const { result } = renderHook(() => useIssues(value), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(result.current.sort).toBe('newest');
  });

  it('search の絞り込みと並びを反映する', async () => {
    serveIssues(issues);
    const { value } = listSearch<IssuesSearch>({ category: 'education', sort: 'severity' });
    const { result } = renderHook(() => useIssues(value), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['c', 'a']);
    expect(result.current.total).toBe(2);
  });

  it('絞り込みを変えるとページを先頭に戻し、既定値は URL から外す', async () => {
    serveIssues(issues);
    const { value, setSearch } = listSearch<IssuesSearch>({ page: 3 });
    const { result } = renderHook(() => useIssues(value), { wrapper: wrapper() });
    result.current.setCategory('governance');
    expect(setSearch).toHaveBeenLastCalledWith({ category: 'governance', page: undefined });
    result.current.setSort('newest');
    expect(setSearch).toHaveBeenLastCalledWith({ sort: undefined, page: undefined });
    result.current.setSort('urgency');
    expect(setSearch).toHaveBeenLastCalledWith({ sort: 'urgency', page: undefined });
    result.current.setPage(1);
    expect(setSearch).toHaveBeenLastCalledWith({ page: undefined });
    result.current.setPage(2);
    expect(setSearch).toHaveBeenLastCalledWith({ page: 2 });
  });

  it('20 件ずつページ送りする', async () => {
    serveIssues(Array.from({ length: 45 }, (_, i) => makeIssue({ id: `x${i}` })));
    const { value } = listSearch<IssuesSearch>({ page: 3 });
    const { result } = renderHook(() => useIssues(value), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.items).toHaveLength(5);
    expect(result.current.pageCount).toBe(3);
  });

  it('旧アプリの実データ（未分類のみ）を読める', async () => {
    serveIssues(readLegacyJson('issue', 'issues.json') as JsonBodyType);
    const { value } = listSearch<IssuesSearch>({ category: 'none' });
    const { result } = renderHook(() => useIssues(value), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.total).toBe(300);
  });

  it('スキーマに合わないデータはエラーになる', async () => {
    serveIssues([{ id: 1 }]);
    const { value } = listSearch<IssuesSearch>({});
    const { result } = renderHook(() => useIssues(value), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});

describe('useIssue', () => {
  it('id で課題を返す', async () => {
    serveIssues([makeIssue({ id: 'a' }), makeIssue({ id: 'b', originalTitle: 'B' })]);
    const { result } = renderHook(() => useIssue('b'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.issue?.originalTitle).toBe('B'));
    expect(result.current.notFound).toBe(false);
  });

  it('無い id は notFound', async () => {
    serveIssues([makeIssue({ id: 'a' })]);
    const { result } = renderHook(() => useIssue('zzz'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.notFound).toBe(true));
  });
});

describe('useIdeas / useIdea / useTopIdeas', () => {
  const ideas = [
    makeIdea({ id: 'a', difficulty: 'low', appifiabilityScore: 65 }),
    makeIdea({ id: 'b', difficulty: 'high', appifiabilityScore: 90 }),
    makeIdea({ id: 'c', difficulty: 'low', appifiabilityScore: 80 }),
  ];

  it('既定はアプリ化スコア順', async () => {
    serveIdeas(ideas);
    const { value } = listSearch<IdeasSearch>({});
    const { result } = renderHook(() => useIdeas(value), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('難易度で絞れる', async () => {
    serveIdeas(ideas);
    const { value } = listSearch<IdeasSearch>({ difficulty: 'low' });
    const { result } = renderHook(() => useIdeas(value), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(['c', 'a']);
  });

  it('id で引く', async () => {
    serveIdeas(ideas);
    const { result } = renderHook(() => useIdea('c'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.idea?.id).toBe('c'));
  });

  it('上位を件数制限つきで返す', async () => {
    serveIdeas(ideas);
    const { result } = renderHook(() => useTopIdeas(2), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ideas).toHaveLength(2));
    expect(result.current.ideas.map((i) => i.id)).toEqual(['b', 'c']);
  });
});

describe('useCategorySummary / useIssueFreshness', () => {
  it('空の集計では hasData が false で、セルは全カテゴリぶん並ぶ', async () => {
    server.use(http.get('*/data/issue/category-summary.json', () => HttpResponse.json([])));
    const { result } = renderHook(() => useCategorySummary(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.hasData).toBe(false);
    expect(result.current.cells).toHaveLength(8);
  });

  it('集計をセルに変換する', async () => {
    server.use(
      http.get('*/data/issue/category-summary.json', () =>
        HttpResponse.json([{ category: 'education', count: 4, avgSeverity: 50, avgAppifiability: 20 }]),
      ),
    );
    const { result } = renderHook(() => useCategorySummary(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.cells.find((c) => c.category === 'education')?.count).toBe(4);
  });

  it('旧形式の meta.json からも鮮度を出す', async () => {
    server.use(http.get('*/data/issue/meta.json', () => HttpResponse.json(readLegacyJson('issue', 'meta.json') as JsonBodyType)));
    const { result } = renderHook(() => useIssueFreshness(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current?.generatedAt).toBeTruthy());
  });
});

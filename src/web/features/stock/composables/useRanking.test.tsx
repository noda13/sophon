import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, useMemo, useState } from 'react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { type RankingRow, RankingFileSchema } from '../../../../shared/schema/stock';
import { readLegacyJson } from '../../../../shared/schema/legacy-data.testutil';
import { OKU_YEN } from '../logic/filters';
import { makeQueryClient, useStockDataServer } from '../stock.testutil';
import { type RankingSearch, rankingSearchSchema } from './rankingSearch';
import { useRanking } from './useRanking';

const server = useStockDataServer();

const kiyohara = RankingFileSchema.parse(readLegacyJson('stock', 'ranking-kiyohara.json'));

// useListSearch が route に求める形を、URL を介さず state で満たす
function useHarness(initial: object = {}) {
  const [search, setState] = useState<RankingSearch>(() => rankingSearchSchema.parse(initial));
  const route = useMemo(
    () => ({
      useSearch: () => search,
      useNavigate: () => (options: { search: (prev: RankingSearch) => RankingSearch }) =>
        setState((prev) => options.search(prev)),
    }),
    [search],
  );
  const ranking = useRanking(route);
  return { ranking, search };
}

function setup(initial: object = {}) {
  const client = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useHarness(initial), { wrapper });
  return view;
}

const shownRows = (ranking: ReturnType<typeof useHarness>['ranking']): RankingRow[] =>
  ranking.table.getRowModel().rows.map((r) => r.original);

describe('useRanking', () => {
  it('既定の戦略のランキングを 50 件ずつ返す', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));

    const { ranking } = result.current;
    expect(ranking.strategy).toBe('kiyohara');
    expect(ranking.sourceCount).toBe(kiyohara.length);
    expect(shownRows(ranking)).toHaveLength(50);
    expect(ranking.strategies.length).toBeGreaterThan(1);
    expect(ranking.strategyMeta?.displayName).toBe('清原流');
  });

  it('時価総額の下限（億円）で行が減り、順位が振り直される', async () => {
    const { result } = setup({ pageSize: 200 });
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));
    const threshold = 100;
    const expected = kiyohara.filter((r) => r.marketCap >= threshold * OKU_YEN).length;
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(kiyohara.length);

    act(() => result.current.ranking.setMinCap(threshold));

    const { ranking } = result.current;
    expect(ranking.matchedCount).toBe(expected);
    expect(shownRows(ranking).every((r) => r.marketCap >= threshold * OKU_YEN)).toBe(true);
    expect(shownRows(ranking).map((r) => r.rank)).toEqual(Array.from({ length: expected }, (_, i) => i + 1));
    expect(result.current.search.minCap).toBe(threshold);
    expect(ranking.hasFilter).toBe(true);
  });

  it('上限と除外セクターで絞り込み、解除すると戻る', async () => {
    const { result } = setup({ pageSize: 200 });
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));
    const sector = result.current.ranking.sectors[0];
    expect(sector).toBeDefined();
    const withoutSector = kiyohara.filter((r) => r.sector33Name !== sector).length;

    act(() => result.current.ranking.setExcludeSectors([sector as string]));
    expect(result.current.ranking.matchedCount).toBe(withoutSector);
    expect(result.current.search.exclude).toEqual([sector]);

    act(() => result.current.ranking.setMaxCap(50));
    expect(shownRows(result.current.ranking).every((r) => r.marketCap <= 50 * OKU_YEN)).toBe(true);

    act(() => result.current.ranking.resetFilters());
    expect(result.current.ranking.matchedCount).toBe(kiyohara.length);
    expect(result.current.search).toMatchObject({ exclude: undefined, maxCap: undefined });
  });

  it('条件を変えると 1 ページ目に戻る', async () => {
    const { result } = setup({ page: 3 });
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));
    expect(result.current.ranking.page).toBe(3);

    act(() => result.current.ranking.setMinCap(10));
    expect(result.current.ranking.page).toBe(1);
  });

  it('ページ送りは URL の page で表示範囲を変える', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));

    act(() => result.current.ranking.setPage(2));
    expect(result.current.search.page).toBe(2);
    expect(shownRows(result.current.ranking)[0]?.rank).toBe(51);
  });

  it('戦略を切り替えると別のランキングを読み、既定の戦略は URL に出さない', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));

    act(() => result.current.ranking.setStrategy('graham'));
    expect(result.current.search.strategy).toBe('graham');
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));
    expect(result.current.ranking.strategyMeta?.id).toBe('graham');
    const graham = RankingFileSchema.parse(readLegacyJson('stock', 'ranking-graham.json'));
    expect(shownRows(result.current.ranking)[0]?.code).toBe(graham[0]?.code);

    act(() => result.current.ranking.setStrategy('kiyohara'));
    expect(result.current.search.strategy).toBeUndefined();
  });

  it('列の並べ替えは URL の sort と desc で決まる', async () => {
    const { result } = setup({ sort: 'marketCap', desc: true, pageSize: 200 });
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));

    const caps = shownRows(result.current.ranking).map((r) => r.marketCap);
    expect(caps).toEqual([...caps].sort((a, b) => b - a));
  });

  it('検索語でコードと銘柄名を絞り込む', async () => {
    const { result } = setup({ pageSize: 200 });
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));
    const target = kiyohara[0] as RankingRow;

    act(() => result.current.ranking.setQuery(target.code));
    expect(shownRows(result.current.ranking).map((r) => r.code)).toContain(target.code);
    expect(result.current.ranking.matchedCount).toBeLessThan(kiyohara.length);
    expect(result.current.search.q).toBe(target.code);
  });

  it('取得に失敗するとエラーを返す', async () => {
    server.use(http.get('*/data/stock/ranking-lynch.json', () => new HttpResponse(null, { status: 500 })));
    const { result } = setup({ strategy: 'lynch' });
    await waitFor(() => expect(result.current.ranking.isPending).toBe(false));
    expect(result.current.ranking.error).toBeInstanceOf(Error);
    expect(result.current.ranking.sourceCount).toBe(0);
  });
});

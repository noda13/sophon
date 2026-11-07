import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RankingFileSchema, StockDetailSchema } from '../../../shared/schema/stock';
import { readLegacyJson } from '../../../shared/schema/legacy-data.testutil';
import { makeQueryClient, useStockDataServer } from './stock.testutil';
import { routeTree } from '../../routeTree.gen';

useStockDataServer();

const kiyohara = RankingFileSchema.parse(readLegacyJson('stock', 'ranking-kiyohara.json'));

// jsdom 未実装の window.scrollTo を、ルーターの遷移時のスクロール復元が呼ぶ
beforeAll(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(cleanup);

function renderAt(url: string) {
  const queryClient = makeQueryClient();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { queryClient },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const bodyRowCount = () => {
  const [, ...rows] = screen.getAllByRole('row');
  return rows.length;
};

describe('/stock', () => {
  it('ランキングを 50 件ずつ表に出し、鮮度と免責を上部に出す', async () => {
    renderAt('/stock');

    expect(await screen.findByRole('heading', { name: /清原流ランキング/ })).toBeTruthy();
    expect(bodyRowCount()).toBe(50);
    expect(screen.getByText(`${kiyohara.length} / ${kiyohara.length} 件`)).toBeTruthy();
    expect(screen.getAllByText(/投資助言ではありません/).length).toBeGreaterThan(0);
    await screen.findByText(/更新/);
    expect(screen.getByRole('link', { name: kiyohara[0]?.code ?? '' }).getAttribute('href')).toBe(
      `/stock/${kiyohara[0]?.code}`,
    );
  });

  it('戦略タブを出し、URL の戦略で別のランキングを読む', async () => {
    renderAt('/stock?strategy=graham');

    expect(await screen.findByRole('heading', { name: /グレアム流ランキング/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '清原流' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'グレアム流' }).getAttribute('aria-selected')).toBe('true');
  });

  it('時価総額の下限を入力すると行が減り、URL に載る', async () => {
    const router = renderAt('/stock?pageSize=200');
    await screen.findByRole('heading', { name: /清原流ランキング/ });
    expect(bodyRowCount()).toBe(kiyohara.length);

    const expected = kiyohara.filter((r) => r.marketCap >= 100 * 100_000_000).length;
    fireEvent.change(screen.getByLabelText('時価総額の下限（億円）'), { target: { value: '100' } });

    await waitFor(() => expect(bodyRowCount()).toBe(expected));
    expect(router.state.location.search).toMatchObject({ minCap: 100 });
    expect(screen.getByRole('button', { name: '絞り込みを解除' })).toBeTruthy();
  });

  it('除外セクターのチェックで該当銘柄が消える', async () => {
    renderAt('/stock?pageSize=200');
    await screen.findByRole('heading', { name: /清原流ランキング/ });
    const sector = kiyohara.find((r) => r.sector33Name)?.sector33Name as string;
    const expected = kiyohara.filter((r) => r.sector33Name !== sector).length;

    fireEvent.click(screen.getByLabelText(sector));

    await waitFor(() => expect(bodyRowCount()).toBe(expected));
  });

  it('条件に合う銘柄がなければその旨を出す', async () => {
    renderAt('/stock?minCap=99999999');
    expect(await screen.findByText('条件に合う銘柄がありません')).toBeTruthy();
  });

  it('壊れた search params は無かったことにして表示する', async () => {
    renderAt('/stock?strategy=nope&minCap=abc');
    expect(await screen.findByRole('heading', { name: /清原流ランキング/ })).toBeTruthy();
  });

  it('列見出しのクリックで並べ替え、URL に載る', async () => {
    const router = renderAt('/stock');
    await screen.findByRole('heading', { name: /清原流ランキング/ });

    fireEvent.click(within(screen.getAllByRole('columnheader')[4] as HTMLElement).getByRole('button'));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ sort: 'marketCap', desc: true }));
  });
});

describe('/stock/$code', () => {
  it('概要、財務グラフの見出し、スコア、外部リンクを出す', async () => {
    const detail = StockDetailSchema.parse(readLegacyJson('stock', 'stock-1301.json'));
    renderAt('/stock/1301');

    expect(await screen.findByRole('heading', { name: detail.profile.name })).toBeTruthy();
    expect(screen.getByText('財務推移（単位：億円）')).toBeTruthy();
    expect(screen.getByText('投資視点スコア')).toBeTruthy();
    expect(screen.getAllByRole('meter')).toHaveLength(Object.keys(detail.strategies).length);
    expect(screen.getByRole('link', { name: /kabutan/ }).getAttribute('href')).toContain('code=1301');
    expect(screen.getByRole('link', { name: /ランキングに戻る/ }).getAttribute('href')).toBe('/stock');
  });

  it('存在しない銘柄はエラーを出し、ランキングへ戻れる', async () => {
    renderAt('/stock/0000');
    expect(await screen.findByText(/銘柄データの取得に失敗しました/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /ランキングに戻る/ })).toBeTruthy();
  });
});

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { StockDetailSchema } from '../../../../shared/schema/stock';
import { readLegacyJson } from '../../../../shared/schema/legacy-data.testutil';
import { makeQueryClient, useStockDataServer } from '../stock.testutil';
import { useStockDetail, useStockFreshness } from './useStockDetail';

useStockDataServer();

function wrapperFor() {
  const client = makeQueryClient();
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useStockDetail', () => {
  it('銘柄の概要、財務の推移、戦略ごとのスコアを返す', async () => {
    const raw = StockDetailSchema.parse(readLegacyJson('stock', 'stock-1301.json'));
    const { result } = renderHook(() => useStockDetail('1301'), { wrapper: wrapperFor() });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.profile?.name).toBe(raw.profile.name);
    expect(result.current.latestSnapshot?.marketCap).toBe(raw.profile.snapshots[0]?.marketCap);
    expect(result.current.points).toHaveLength(raw.history.length);
    expect(result.current.scores.length).toBe(Object.keys(raw.strategies).length);
    expect(result.current.scores[0]?.label).toBe('清原流');
  });

  it('存在しない銘柄はエラーを返す', async () => {
    const { result } = renderHook(() => useStockDetail('0000'), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.profile).toBeUndefined();
  });
});

describe('useStockFreshness', () => {
  it('meta.json から更新時刻と健全性を返す', async () => {
    const { result } = renderHook(() => useStockFreshness(), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.health).toBe('ok');
    expect(result.current?.generatedAt).toBe('2026-05-13T13:41:23.560Z');
    expect(result.current?.isStale).toBe(true);
  });
});

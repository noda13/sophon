import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { econQueries, prefetchEconDashboard, useEconDashboard } from './useEconDashboard';
import { econHandlers, makeWrapper } from './econ.testutil';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useEconDashboard', () => {
  it('7ファイルを読んで合成する', async () => {
    server.use(...econHandlers());
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEconDashboard(), { wrapper });

    await waitFor(() => expect(result.current.sections.events.isPending).toBe(false));
    await waitFor(() => expect(result.current.meta).toBeDefined());

    expect(result.current.isError).toBe(false);
    expect(result.current.risks?.length).toBeGreaterThan(0);
    expect(result.current.composite?.compositeScore).toBeTypeOf('number');
    expect(result.current.indicators?.length).toBeGreaterThan(0);
    expect(result.current.topNews.length).toBeLessThanOrEqual(20);
    expect(result.current.trend.length).toBeGreaterThan(0);
    expect(result.current.freshness.generatedAt).toBeInstanceOf(Date);
    // 実データは古いので、3日の閾値を超えて stale になる
    expect(result.current.freshness.isStale).toBe(true);
  });

  it('events の失敗は他のセクションに波及しない', async () => {
    server.use(...econHandlers({ 'events.json': new HttpResponse(null, { status: 500 }) }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEconDashboard(), { wrapper });

    await waitFor(() => expect(result.current.sections.events.isError).toBe(true));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.risks?.length).toBeGreaterThan(0);
  });

  it('risks の失敗は isError になる', async () => {
    server.use(...econHandlers({ 'risks.json': new HttpResponse(null, { status: 500 }) }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEconDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('meta がなくても鮮度は unknown で返る', async () => {
    server.use(...econHandlers({ 'meta.json': new HttpResponse(null, { status: 404 }) }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEconDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.freshness.health).toBe('unknown');
  });
});

describe('prefetchEconDashboard', () => {
  it('risks と composite をキャッシュに載せる', async () => {
    server.use(...econHandlers());
    const { client } = makeWrapper();
    await prefetchEconDashboard(client);
    expect(client.getQueryData(econQueries.risks().queryKey)).toBeDefined();
    expect(client.getQueryData(econQueries.composite().queryKey)).toBeDefined();
  });
});

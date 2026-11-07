import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { sourceQueryOptions, sourceUrl, useSourceQuery } from './useSourceQuery';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const Schema = z.object({ items: z.array(z.object({ id: z.number() })) });

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('sourceQueryOptions', () => {
  it('キーは [source, file] になる', () => {
    expect(sourceQueryOptions('stock', 'stocks.json', Schema).queryKey).toEqual(['stock', 'stocks.json']);
  });

  it('URL は BASE_URL 配下の data/<source>/<file> になる', () => {
    expect(sourceUrl('tech', 'digest/2026-01-01.json')).toBe(
      `${new URL(import.meta.env.BASE_URL, globalThis.location.href).href}data/tech/digest/2026-01-01.json`,
    );
  });

  it('ensureQueryData で先読みできる', async () => {
    server.use(http.get('*/data/issue/issues.json', () => HttpResponse.json({ items: [{ id: 1 }] })));
    const { client } = makeWrapper();
    const data = await client.ensureQueryData(sourceQueryOptions('issue', 'issues.json', Schema));
    expect(data.items).toHaveLength(1);
  });
});

describe('useSourceQuery', () => {
  it('成功すると検証済みのデータを返す', async () => {
    server.use(http.get('*/data/stock/stocks.json', () => HttpResponse.json({ items: [{ id: 1 }, { id: 2 }] })));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSourceQuery('stock', 'stocks.json', Schema), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [{ id: 1 }, { id: 2 }] });
  });

  it('スキーマに合わないと、場所つきの Error になる', async () => {
    server.use(http.get('*/data/stock/stocks.json', () => HttpResponse.json({ items: [{ id: 'x' }] })));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSourceQuery('stock', 'stocks.json', Schema), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('stock/stocks.json');
    expect(result.current.error?.message).toContain('items.0.id');
  });

  it('HTTP エラーはステータスつきの Error になる', async () => {
    server.use(http.get('*/data/stock/stocks.json', () => new HttpResponse(null, { status: 404 })));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSourceQuery('stock', 'stocks.json', Schema), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('HTTP 404');
  });

  it('JSON でない本文は Error になる', async () => {
    server.use(http.get('*/data/stock/stocks.json', () => new HttpResponse('<html>', { status: 200 })));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSourceQuery('stock', 'stocks.json', Schema), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('JSON として読めません');
  });
});

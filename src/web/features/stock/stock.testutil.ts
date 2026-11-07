import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { readLegacyJson } from '../../../shared/schema/legacy-data.testutil';

function legacyResponse(file: string) {
  try {
    return HttpResponse.json(readLegacyJson('stock', file) as Record<string, unknown>);
  } catch {
    return new HttpResponse(null, { status: 404 });
  }
}

// 旧 apps の実データを、新しい data/stock/ の配置（stocks/<code>.json）で返す
export function useStockDataServer() {
  const server = setupServer(
    http.get('*/data/stock/stocks/:file', ({ params }) =>
      legacyResponse(`stock-${String(params.file).replace(/\.json$/, '')}.json`),
    ),
    http.get('*/data/stock/:file', ({ params }) => legacyResponse(String(params.file))),
  );
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

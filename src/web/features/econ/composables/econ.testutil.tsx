import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { readLegacyJson } from '../../../../shared/schema/legacy-data.testutil';

export const ECON_FILES = [
  'news.json',
  'risks.json',
  'risk-history.json',
  'indicators.json',
  'composite-risk.json',
  'events.json',
  'meta.json',
] as const;

export function econHandlers(overrides: Partial<Record<(typeof ECON_FILES)[number], Response | unknown>> = {}) {
  return ECON_FILES.map((file) =>
    http.get(`*/data/econ/${file}`, () => {
      const override = overrides[file];
      if (override instanceof Response) return override;
      return HttpResponse.json((override ?? readLegacyJson('econ', file)) as never);
    }),
  );
}

export function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

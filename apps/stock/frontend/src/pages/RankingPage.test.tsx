import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RankingPage } from './RankingPage';
import { fetchStrategyRanking } from '../services/api';
import type { RankingRow } from '../lib/types';

vi.mock('../services/api', () => ({
  fetchStrategies: vi.fn(async () => [
    { id: 'kiyohara', displayName: '清原流', description: 'NCR重視', active: true },
  ]),
  fetchStrategyRanking: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RankingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const row: RankingRow = {
  code: '1234',
  name: 'テスト商事',
  sector33Name: '卸売業',
  marketSegment: 'Growth',
  marketCap: 2_000_000_000,
  netCash: 3_000_000_000,
  netCashRatio: 1.5,
  cashNeutralPer: 4,
  per: 8,
  pbr: 0.8,
  profit: 250_000_000,
  equity: 5_000_000_000,
  rank: 1,
  strategyScore: { score: 90, components: {}, reason: '高スコア' },
  snapshotAt: '2026-01-01T00:00:00Z',
};

describe('RankingPage', () => {
  it('renders ranking rows with a link to the stock detail', async () => {
    vi.mocked(fetchStrategyRanking).mockResolvedValue([row]);
    renderPage();
    expect(await screen.findByText('テスト商事')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1234' })).toHaveAttribute('href', '/stock/1234');
    expect(screen.getByText('90')).toHaveAttribute('title', '高スコア');
  });

  it('renders the empty state when there are no rows', async () => {
    vi.mocked(fetchStrategyRanking).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('データがありません')).toBeInTheDocument();
  });

  it('renders the error state when the fetch fails', async () => {
    vi.mocked(fetchStrategyRanking).mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });
});

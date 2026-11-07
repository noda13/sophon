import { createFileRoute } from '@tanstack/react-router';
import { Pagination } from '../../ui/Pagination';
import { Disclaimer } from '../../ui/Disclaimer';
import { EmptyState } from '../../ui/EmptyState';
import { FreshnessBadge } from '../../ui/FreshnessBadge';
import { Loading } from '../../ui/Loading';
import { RankingFilters } from '../../features/stock/components/RankingFilters';
import { RankingTable } from '../../features/stock/components/RankingTable';
import { StockError } from '../../features/stock/components/StockError';
import { StrategySelector } from '../../features/stock/components/StrategySelector';
import { DEFAULT_STRATEGY, rankingSearchSchema } from '../../features/stock/composables/rankingSearch';
import { stockQueryOptions } from '../../features/stock/composables/stockQueries';
import { useRanking } from '../../features/stock/composables/useRanking';
import { useStockFreshness } from '../../features/stock/composables/useStockDetail';
import { formatDateTime } from '../../features/stock/logic/formatters';
import { t } from '../../features/stock/logic/i18n';

export const Route = createFileRoute('/stock/')({
  validateSearch: rankingSearchSchema,
  loaderDeps: ({ search }) => ({ strategy: search.strategy ?? DEFAULT_STRATEGY }),
  loader: async ({ context: { queryClient }, deps }) => {
    // 鮮度の表示は補助情報なので、取得に失敗してもページは出す
    void queryClient.prefetchQuery(stockQueryOptions.meta());
    await Promise.all([
      queryClient.ensureQueryData(stockQueryOptions.strategies()),
      queryClient.ensureQueryData(stockQueryOptions.ranking(deps.strategy)),
    ]);
  },
  pendingComponent: () => <Loading />,
  errorComponent: ({ error }) => <StockError title={t('fetchError')} error={error} />,
  component: StockRankingPage,
});

function StockRankingPage() {
  const ranking = useRanking(Route);
  const freshness = useStockFreshness();

  if (ranking.isPending) return <Loading />;
  if (ranking.error) return <StockError title={t('fetchError')} error={ranking.error} />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {freshness && <FreshnessBadge {...freshness} />}
        <Disclaimer />
      </div>

      <StrategySelector strategies={ranking.strategies} value={ranking.strategy} onChange={ranking.setStrategy} />

      <div>
        <h1 className="text-xl font-semibold">
          {ranking.strategyMeta?.displayName ?? ranking.strategy}
          {t('rankingTitle')}
          <span className="ml-2 text-sm font-normal text-fg-muted">{t('rankingSubtitle')}</span>
        </h1>
        {ranking.strategyMeta?.description && (
          <p className="mt-1 text-sm text-fg-muted">{ranking.strategyMeta.description}</p>
        )}
      </div>

      {ranking.sourceCount === 0 ? (
        <EmptyState title={t('noData')} />
      ) : (
        <>
          <RankingFilters
            query={ranking.query}
            onQueryChange={ranking.setQuery}
            minCap={ranking.minCap}
            maxCap={ranking.maxCap}
            onMinCapChange={ranking.setMinCap}
            onMaxCapChange={ranking.setMaxCap}
            sectors={ranking.sectors}
            excludedSectors={ranking.excludeSectors}
            onExcludedSectorsChange={ranking.setExcludeSectors}
            hasFilter={ranking.hasFilter}
            onReset={ranking.resetFilters}
          />
          <p className="text-xs text-fg-muted" aria-live="polite">
            {ranking.matchedCount} / {ranking.sourceCount} {t('resultCount')}
          </p>
          <RankingTable table={ranking.table} />
          <Pagination
            page={ranking.page}
            pageSize={ranking.pageSize}
            totalCount={ranking.matchedCount}
            onPageChange={ranking.setPage}
          />
          <p className="text-xs text-fg-subtle">
            {t('dataFetchedAt')}: {formatDateTime(ranking.snapshotAt)}
          </p>
        </>
      )}
    </div>
  );
}

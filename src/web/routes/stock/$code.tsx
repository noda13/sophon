import { Link, createFileRoute } from '@tanstack/react-router';
import { Disclaimer } from '../../ui/Disclaimer';
import { FreshnessBadge } from '../../ui/FreshnessBadge';
import { Loading } from '../../ui/Loading';
import { ExternalLinks } from '../../features/stock/components/ExternalLinks';
import { FinancialChart } from '../../features/stock/components/FinancialChart';
import { StockError } from '../../features/stock/components/StockError';
import { StockProfileCard } from '../../features/stock/components/StockProfileCard';
import { StrategyScoreCard } from '../../features/stock/components/StrategyScoreCard';
import { stockQueryOptions } from '../../features/stock/composables/stockQueries';
import { useStockDetail, useStockFreshness } from '../../features/stock/composables/useStockDetail';
import { t } from '../../features/stock/logic/i18n';

export const Route = createFileRoute('/stock/$code')({
  loader: async ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(stockQueryOptions.meta());
    // スコアの表示名は補助情報なので、取得に失敗しても銘柄の詳細は出す
    void queryClient.prefetchQuery(stockQueryOptions.strategies());
    await queryClient.ensureQueryData(stockQueryOptions.detail(params.code));
  },
  pendingComponent: () => <Loading />,
  errorComponent: ({ error }) => <StockError title={t('stockFetchFailed')} error={error} />,
  component: StockDetailPage,
});

function StockDetailPage() {
  const { code } = Route.useParams();
  const detail = useStockDetail(code);
  const freshness = useStockFreshness();

  if (detail.isPending) return <Loading />;
  if (detail.error || !detail.profile) return <StockError title={t('stockFetchFailed')} error={detail.error} />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {freshness && <FreshnessBadge {...freshness} />}
        <Disclaimer />
      </div>

      <Link to="/stock" className="inline-block text-sm text-accent hover:underline">
        {t('backToRanking')}
      </Link>

      <StockProfileCard profile={detail.profile} snapshot={detail.latestSnapshot} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FinancialChart points={detail.points} />
        </div>
        <ExternalLinks code={code} />
      </div>

      {detail.scores.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">{t('investmentScores')}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {detail.scores.map((item) => (
              <StrategyScoreCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

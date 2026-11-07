import { lazy, Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { CompositeRiskBanner } from '../components/dashboard/CompositeRiskBanner';
import { RiskOverview } from '../components/dashboard/RiskOverview';
import { IndicatorPanel } from '../components/dashboard/IndicatorPanel';
import { NewsFeed } from '../components/dashboard/NewsFeed';
import { PortfolioImpactPanel } from '../components/dashboard/PortfolioImpactPanel';
import { EventCalendar } from '../components/dashboard/EventCalendar';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { getRunWarnings } from '../lib/runHealth';
import { fetchRisks, fetchCompositeRisk, fetchMeta } from '../services/api';

// recharts が初期ロードの大半を占めるため、チャートは遅延読み込みする
const RiskTrendChart = lazy(() =>
  import('../components/dashboard/RiskTrendChart').then(m => ({ default: m.RiskTrendChart })),
);

const STALE_THRESHOLD_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function DashboardPage() {
  const { data: risks, isError: isRisksError } = useQuery({ queryKey: ['risks'], queryFn: fetchRisks });
  const { isError: isCompositeError } = useQuery({ queryKey: ['compositeRisk'], queryFn: fetchCompositeRisk });
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });
  const riskUpdatedAt = meta?.lastUpdated;

  const lastUpdated = useMemo(() => {
    if (!risks?.length) return undefined;
    return risks.reduce((a, b) =>
      new Date(a.assessedAt) > new Date(b.assessedAt) ? a : b
    ).assessedAt;
  }, [risks]);

  const ageMs = riskUpdatedAt ? Date.now() - new Date(riskUpdatedAt).getTime() : 0;
  const staleDays = ageMs > STALE_THRESHOLD_DAYS * MS_PER_DAY ? Math.floor(ageMs / MS_PER_DAY) : 0;

  const runWarnings = getRunWarnings(meta?.lastRun);

  return (
    <DashboardLayout lastUpdated={lastUpdated}>
      {staleDays > 0 && (
        <div className="rounded-lg border border-amber-700 bg-amber-900/30 px-4 py-3 text-sm text-amber-300">
          リスク評価が {staleDays} 日間更新されていません。表示内容は古い可能性があります。
        </div>
      )}
      {runWarnings.map(w => (
        <div key={w} className="rounded-lg border border-amber-700 bg-amber-900/30 px-4 py-3 text-sm text-amber-300">
          {w}
        </div>
      ))}
      {(isRisksError || isCompositeError) && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          リスクデータの取得に失敗しました。しばらくしてからページを再読み込みしてください。
        </div>
      )}
      <CompositeRiskBanner />
      <RiskOverview />
      <PortfolioImpactPanel />
      <Suspense fallback={<LoadingSpinner />}>
        <RiskTrendChart />
      </Suspense>
      <IndicatorPanel />
      <EventCalendar />
      <NewsFeed />
    </DashboardLayout>
  );
}

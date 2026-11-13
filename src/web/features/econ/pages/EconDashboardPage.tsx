import { Suspense, lazy, useState } from 'react';
import { Disclaimer } from '../../../ui/Disclaimer';
import { ErrorBox } from '../../../ui/ErrorBox';
import { FreshnessBadge, toFreshnessBadgeProps } from '../../../ui/FreshnessBadge';
import { Loading } from '../../../ui/Loading';
import { CompositeRiskBanner } from '../components/CompositeRiskBanner';
import { EventCalendar } from '../components/EventCalendar';
import { IndicatorPanel } from '../components/IndicatorPanel';
import { NewsFeed } from '../components/NewsFeed';
import { PortfolioImpactPanel } from '../components/PortfolioImpactPanel';
import { RiskOverview } from '../components/RiskOverview';
import { HISTORY_DAYS, useEconDashboard } from '../composables/useEconDashboard';
import { usePersonalizedRisk } from '../composables/usePersonalizedRisk';
import { useRiskProfile } from '../composables/useRiskProfile';

// recharts が初期ロードの大半を占めるため、チャートとダイアログは遅延読み込みする
const RiskTrendChart = lazy(() =>
  import('../components/RiskTrendChart').then((m) => ({ default: m.RiskTrendChart })),
);
const ProfileDialog = lazy(() =>
  import('../components/ProfileDialog').then((m) => ({ default: m.ProfileDialog })),
);

export function EconDashboardPage() {
  const dashboard = useEconDashboard();
  const { profile, saveProfile, clearProfile } = useRiskProfile();
  const personalized = usePersonalizedRisk(profile, dashboard.composite, dashboard.risks);

  const [dialogOpen, setDialogOpen] = useState(false);
  // 一度開いたら外さず、編集中の入力をダイアログを閉じても保持する
  const [dialogMounted, setDialogMounted] = useState(false);

  const { freshness, sections } = dashboard;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">Econoguard</h1>
          <p className="text-xs text-fg-subtle">グローバル経済リスクモニター</p>
        </div>
        <div className="flex items-start gap-4">
          {dashboard.meta && <FreshnessBadge {...toFreshnessBadgeProps(freshness)} />}
          <button
            type="button"
            onClick={() => {
              setDialogMounted(true);
              setDialogOpen(true);
            }}
            aria-label={profile ? 'プロフィール設定（設定済み）' : 'プロフィール設定'}
            className="relative rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-fg-muted hover:border-border-strong hover:text-fg"
          >
            プロフィール
            {profile && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <Disclaimer />

      {freshness.health !== 'ok' && freshness.errors.length > 0 && (
        <ul className="space-y-1 text-xs text-fg-subtle">
          {freshness.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {dashboard.isError ? (
        <ErrorBox message="リスクデータの取得に失敗しました。しばらくしてからページを再読み込みしてください。" />
      ) : dashboard.isPending ? (
        <Loading />
      ) : (
        <>
          {dashboard.composite && (
            <CompositeRiskBanner
              composite={dashboard.composite}
              personalized={personalized.result}
              hasProfile={profile !== null}
            />
          )}
          <RiskOverview
            risks={dashboard.risks ?? []}
            news={dashboard.allNews}
            impactByCategory={personalized.impactByCategory}
          />
          <PortfolioImpactPanel personalized={personalized.result} />
          {!sections.history.isError && (
            <Suspense fallback={<Loading />}>
              <RiskTrendChart trend={dashboard.trend} days={HISTORY_DAYS} thresholds={personalized.thresholds} />
            </Suspense>
          )}
          <IndicatorPanel
            indicators={dashboard.indicators ?? []}
            relevanceFor={personalized.relevanceFor}
            isError={sections.indicators.isError}
          />
          <EventCalendar events={dashboard.events ?? []} isError={sections.events.isError} />
          <NewsFeed
            articles={dashboard.topNews}
            hasAnyNews={dashboard.allNews.length > 0}
            isError={sections.news.isError}
          />
        </>
      )}

      {dialogMounted && (
        <Suspense fallback={null}>
          <ProfileDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            profile={profile}
            onSave={saveProfile}
            onClear={clearProfile}
          />
        </Suspense>
      )}
    </div>
  );
}

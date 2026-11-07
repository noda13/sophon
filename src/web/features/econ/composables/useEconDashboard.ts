import type { QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  CompositeRiskSchema,
  EventsFileSchema,
  IndicatorsFileSchema,
  NewsFileSchema,
  RiskHistoryFileSchema,
  RisksFileSchema,
} from '../../../../shared/schema/econ';
import type { RiskAssessment, RiskCategory } from '../../../../shared/schema/econ';
import { AnyMetaSchema } from '../../../../shared/schema/meta';
import { useFreshness } from '../../../composables/useFreshness';
import { sourceQueryOptions, useSourceQuery } from '../../../composables/useSourceQuery';
import { buildTrend, selectTopNews } from '../logic/dashboard';
import { filterRecentHistory } from '../logic/history';
import { RISK_CATEGORIES } from '../logic/riskColors';

export const HISTORY_DAYS = 30;
// 旧 econ は3日更新がなければ警告していた
export const STALE_AFTER_HOURS = 72;

export const econQueries = {
  news: () => sourceQueryOptions('econ', 'news.json', NewsFileSchema),
  risks: () => sourceQueryOptions('econ', 'risks.json', RisksFileSchema),
  history: () => sourceQueryOptions('econ', 'risk-history.json', RiskHistoryFileSchema),
  indicators: () => sourceQueryOptions('econ', 'indicators.json', IndicatorsFileSchema),
  composite: () => sourceQueryOptions('econ', 'composite-risk.json', CompositeRiskSchema),
  events: () => sourceQueryOptions('econ', 'events.json', EventsFileSchema),
  meta: () => sourceQueryOptions('econ', 'meta.json', AnyMetaSchema),
} as const;

// loader から呼ぶ。prefetchQuery は失敗しても throw しないので、画面側が各セクションのエラーを出す
export async function prefetchEconDashboard(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.prefetchQuery(econQueries.news()),
    queryClient.prefetchQuery(econQueries.risks()),
    queryClient.prefetchQuery(econQueries.history()),
    queryClient.prefetchQuery(econQueries.indicators()),
    queryClient.prefetchQuery(econQueries.composite()),
    queryClient.prefetchQuery(econQueries.events()),
    queryClient.prefetchQuery(econQueries.meta()),
  ]);
}

export interface SectionState {
  isPending: boolean;
  isError: boolean;
}

const EMPTY_NEWS: never[] = [];

export function useEconDashboard() {
  const news = useSourceQuery('econ', 'news.json', NewsFileSchema);
  const risks = useSourceQuery('econ', 'risks.json', RisksFileSchema);
  const history = useSourceQuery('econ', 'risk-history.json', RiskHistoryFileSchema);
  const indicators = useSourceQuery('econ', 'indicators.json', IndicatorsFileSchema);
  const composite = useSourceQuery('econ', 'composite-risk.json', CompositeRiskSchema);
  const events = useSourceQuery('econ', 'events.json', EventsFileSchema);
  const meta = useSourceQuery('econ', 'meta.json', AnyMetaSchema);

  const freshness = useFreshness(meta.data, { staleAfterHours: STALE_AFTER_HOURS });

  const allNews = news.data ?? EMPTY_NEWS;
  const topNews = useMemo(() => selectTopNews(allNews), [allNews]);

  const trend = useMemo(() => {
    const recent: Partial<Record<RiskCategory, RiskAssessment[]>> = {};
    for (const category of RISK_CATEGORIES) {
      recent[category] = filterRecentHistory(history.data?.[category] ?? [], HISTORY_DAYS);
    }
    return buildTrend(recent);
  }, [history.data]);

  const section = (q: { isPending: boolean; isError: boolean }): SectionState => ({
    isPending: q.isPending,
    isError: q.isError,
  });

  return {
    allNews,
    topNews,
    risks: risks.data,
    composite: composite.data,
    trend,
    indicators: indicators.data,
    events: events.data,
    meta: meta.data,
    freshness,
    sections: {
      news: section(news),
      risks: section(risks),
      history: section(history),
      indicators: section(indicators),
      composite: section(composite),
      events: section(events),
    },
    // リスク評価と総合指数が揃わないとページの主役が描けない
    isPending: risks.isPending || composite.isPending,
    isError: risks.isError || composite.isError,
  };
}

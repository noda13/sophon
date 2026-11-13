import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useFreshness } from '../../../composables/useFreshness';
import { type FreshnessBadgeProps, toFreshnessBadgeProps } from '../../../ui/FreshnessBadge';
import { toFinancialPoints } from '../logic/chart';
import { labelScores } from '../logic/scores';
import { stockQueryOptions } from './stockQueries';

export function useStockDetail(code: string) {
  const query = useQuery(stockQueryOptions.detail(code));
  const strategiesQuery = useQuery(stockQueryOptions.strategies());

  const detail = query.data;
  const points = useMemo(() => toFinancialPoints(detail?.history ?? []), [detail]);
  const scores = useMemo(
    () => labelScores(detail?.strategies ?? {}, strategiesQuery.data ?? []),
    [detail, strategiesQuery.data],
  );

  return {
    isPending: query.isPending,
    error: query.error,
    profile: detail?.profile,
    // collector が書くスナップショットは最新の1件だけ
    latestSnapshot: detail?.profile.snapshots[0],
    points,
    scores,
  };
}

// 取得中・取得失敗のあいだは null にして、「確認できません」が一瞬出るのを避ける
export function useStockFreshness(): FreshnessBadgeProps | null {
  const query = useQuery(stockQueryOptions.meta());
  const freshness = useFreshness(query.data);
  return query.data ? toFreshnessBadgeProps(freshness) : null;
}

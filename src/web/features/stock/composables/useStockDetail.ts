import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useFreshness } from '../../../composables/useFreshness';
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

export interface FreshnessBadgeProps {
  generatedAt: string;
  isStale: boolean;
  health: 'ok' | 'partial' | 'failed';
}

// meta.json が読めない、または鮮度を判定できないときは null にして、バッジを出さない
export function useStockFreshness(): FreshnessBadgeProps | null {
  const query = useQuery(stockQueryOptions.meta());
  const freshness = useFreshness(query.data);
  if (!freshness.generatedAt || freshness.health === 'unknown') return null;
  return {
    generatedAt: freshness.generatedAt.toISOString(),
    isStale: freshness.isStale,
    health: freshness.health,
  };
}

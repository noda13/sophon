import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useFreshness } from '../../../composables/useFreshness';
import { type FreshnessBadgeProps, toFreshnessBadgeProps } from '../../../ui/FreshnessBadge';
import { buildHeatmapCells } from '../logic/heatmap';
import { categorySummaryQuery, issueMetaQuery } from './queries';

export function useCategorySummary() {
  const query = useQuery(categorySummaryQuery);
  const cells = useMemo(() => buildHeatmapCells(query.data ?? []), [query.data]);
  return {
    cells,
    // 収集がまだ分類を終えていないと空配列になる。全セルが 0 件の表を出さないための判定
    hasData: (query.data?.length ?? 0) > 0,
    isPending: query.isPending,
    error: query.error,
  };
}

// 取得中・取得失敗のあいだは null にして、「確認できません」が一瞬出るのを避ける
export function useIssueFreshness(): FreshnessBadgeProps | null {
  const { data } = useQuery(issueMetaQuery);
  const freshness = useFreshness(data);
  return data ? toFreshnessBadgeProps(freshness) : null;
}

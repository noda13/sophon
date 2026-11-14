import { useMemo } from 'react';
import { AnyMetaSchema, type LegacyMeta, MetaSchema, type SourceId, legacyToMeta } from '../../../../shared/schema/meta';
import { useFreshness } from '../../../composables/useFreshness';
import { useSourceQuery } from '../../../composables/useSourceQuery';
import { type FreshnessBadgeProps, toFreshnessBadgeProps } from '../../../ui/FreshnessBadge';
import { type SummaryItem, summarizeCounts } from '../logic/summary';

export interface SourceSummary {
  freshness: FreshnessBadgeProps | null;
  items: SummaryItem[];
}

const EMPTY: SourceSummary = { freshness: null, items: [] };

// 取得中・取得失敗のときは空を返し、エラーは出さない。ホームではリンクとして使えれば足りる
export function useSourceSummary(source: SourceId): SourceSummary {
  const { data: meta } = useSourceQuery(source, 'meta.json', AnyMetaSchema);
  const freshness = useFreshness(meta);

  return useMemo(() => {
    if (!meta) return EMPTY;
    const current = MetaSchema.safeParse(meta);
    const normalized = current.success ? current.data : legacyToMeta(source, meta as LegacyMeta);
    const items = normalized ? summarizeCounts(source, normalized.run.counts) : [];
    return { freshness: toFreshnessBadgeProps(freshness), items };
  }, [meta, source, freshness]);
}

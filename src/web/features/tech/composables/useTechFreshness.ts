import { AnyMetaSchema } from '../../../../shared/schema/meta';
import { useFreshness } from '../../../composables/useFreshness';
import { useSourceQuery } from '../../../composables/useSourceQuery';
import { type FreshnessBadgeProps, toFreshnessBadgeProps } from '../../../ui/FreshnessBadge';

// 取得中・取得失敗のあいだは null にして、「確認できません」が一瞬出るのを避ける
export function useTechFreshness(): FreshnessBadgeProps | null {
  const { data } = useSourceQuery('tech', 'meta.json', AnyMetaSchema);
  const freshness = useFreshness(data);
  return data ? toFreshnessBadgeProps(freshness) : null;
}

import { AnyMetaSchema } from '../../../../shared/schema/meta';
import { useFreshness } from '../../../composables/useFreshness';
import { useSourceQuery } from '../../../composables/useSourceQuery';

export function useTechFreshness() {
  const { data } = useSourceQuery('tech', 'meta.json', AnyMetaSchema);
  return useFreshness(data);
}

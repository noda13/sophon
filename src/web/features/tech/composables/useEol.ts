import { EolFileSchema } from '../../../../shared/schema/tech';
import { useSourceQuery } from '../../../composables/useSourceQuery';

export function useEol() {
  return useSourceQuery('tech', 'eol.json', EolFileSchema);
}

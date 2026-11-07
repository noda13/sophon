import { useQuery } from '@tanstack/react-query';
import { DigestIndexSchema, DigestSchema } from '../../../../shared/schema/tech';
import { sourceQueryOptions, useSourceQuery } from '../../../composables/useSourceQuery';
import { adjacentDates, latestDate } from '../logic/digestDates';

export const DIGEST_INDEX_FILE = 'digest/index.json';
export const DIGEST_LATEST_FILE = 'digest-latest.json';

export function digestFile(date: string | undefined, latest: string | undefined): string {
  return date === undefined || date === latest ? DIGEST_LATEST_FILE : `digest/${date}.json`;
}

// date を省略すると最新日。索引（digest/index.json）が無い間は前後の日が分からないだけで、最新の表示は成立させる
export function useDigest(date?: string) {
  const index = useSourceQuery('tech', DIGEST_INDEX_FILE, DigestIndexSchema);
  const dates = index.data?.dates ?? [];
  const latest = latestDate(dates);
  const indexSettled = !index.isPending;

  // 索引にない日付を取りに行くと 404 のエラー表示になる。「その日はない」は別の状態として返す
  const missing = date !== undefined && indexSettled && index.isSuccess && !dates.includes(date);
  const digest = useQuery({
    ...sourceQueryOptions('tech', digestFile(date, latest), DigestSchema),
    enabled: (date === undefined || indexSettled) && !missing,
  });

  const current = date ?? digest.data?.date;
  const { prev, next } = current ? adjacentDates(dates, current) : { prev: null, next: null };

  return {
    digest: missing ? undefined : digest.data,
    date: current,
    prevDate: prev,
    nextDate: next,
    isMissing: missing,
    isPending: !missing && (digest.isPending || (date !== undefined && !indexSettled)),
    error: missing ? null : digest.error,
  };
}

import { useCallback } from 'react';
import type { z } from 'zod';

// Route.useNavigate() の戻り値は route ごとに型が変わるため、必要な形だけを構造的に受ける
export interface ListSearchRoute<TSearch> {
  useSearch: () => TSearch;
  useNavigate: () => (options: {
    search: any;
    replace?: boolean;
  }) => unknown;
}

export interface ListSearch<TSearch> {
  search: TSearch;
  setSearch: (partial: Partial<TSearch>) => void;
  resetSearch: () => void;
}

// スキーマは route の validateSearch と同じものを渡す。ここでは search の型の導出にだけ使い、
// 検証と既定値の補完は route 側に任せる（二重に検証すると既定値が URL に出てしまう）
export function useListSearch<S extends z.ZodType<Record<string, unknown>>>(
  route: ListSearchRoute<z.output<S>>,
  _schema: S,
): ListSearch<z.output<S>> {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  // 履歴を積まないのは、絞り込みを1文字ずつ変えるたびに「戻る」が効かなくなるのを避けるため
  const setSearch = useCallback(
    (partial: Partial<z.output<S>>) => {
      navigate({
        search: (prev: z.output<S>) => ({ ...prev, ...partial }),
        replace: true,
      });
    },
    [navigate],
  );

  const resetSearch = useCallback(() => {
    navigate({ search: {}, replace: true });
  }, [navigate]);

  return { search, setSearch, resetSearch };
}

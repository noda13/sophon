import { queryOptions, useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type { SourceId } from '../../shared/schema/meta';

export function sourceUrl(source: SourceId, file: string): string {
  // jsdom 上の Node の fetch は相対 URL を解決できないため、絶対 URL にしてから渡す
  return new URL(`${import.meta.env.BASE_URL}data/${source}/${file}`, globalThis.location.href).href;
}

function describeIssues(error: z.ZodError): string {
  const shown = error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
  const rest = error.issues.length - shown.length;
  return rest > 0 ? `${shown.join('; ')}; 他 ${rest} 件` : shown.join('; ');
}

async function fetchSource<S extends z.ZodType>(
  source: SourceId,
  file: string,
  schema: S,
  signal: AbortSignal,
): Promise<z.output<S>> {
  const url = sourceUrl(source, file);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${source}/${file} の取得に失敗しました: HTTP ${res.status} ${url}`);

  let json: unknown;
  try {
    json = await res.json();
  } catch (cause) {
    throw new Error(`${source}/${file} は JSON として読めません: ${url}`, { cause });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`${source}/${file} がスキーマに合いません: ${describeIssues(parsed.error)}`, {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function sourceQueryOptions<S extends z.ZodType>(source: SourceId, file: string, schema: S) {
  return queryOptions({
    queryKey: [source, file] as const,
    queryFn: ({ signal }) => fetchSource(source, file, schema, signal),
  });
}

export function useSourceQuery<S extends z.ZodType>(source: SourceId, file: string, schema: S) {
  return useQuery(sourceQueryOptions(source, file, schema));
}

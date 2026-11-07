import { createHash } from 'node:crypto';
import { parseFeed } from 'feedsmith';
import pRetry from 'p-retry';

export interface FeedSource {
  url: string;
  source: string;
}

export interface FeedItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
}

export interface CollectFeedsOptions<S extends FeedSource, T extends { id: string; publishedAt: string }> {
  sources: readonly S[];
  existing: readonly T[];
  toRecord: (item: FeedItem, source: S) => T;
  /** Number of records kept after merging with `existing`, newest first. */
  limit: number;
  /** Ids of articles that left the published list but still appear in feeds. */
  seenIds?: readonly string[];
  /** Receives the `source` of every feed that failed, so the caller can report partial runs. */
  failedSources?: string[];
  fetchOptions?: FetchFeedOptions;
}

export interface FetchFeedOptions {
  timeoutMs?: number;
  /** Retries after the first attempt, for 429, 5xx, timeouts and network errors. */
  retries?: number;
  minRetryDelayMs?: number;
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MIN_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_AFTER_MS = 10_000;

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly retryAfterMs?: number,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpStatusError';
  }
}

export function articleId(url: string, title: string): string {
  return createHash('sha256').update(`${url}:${title}`).digest('hex').slice(0, 16);
}

// Blocks private ranges and plain http so a configurable base URL (RSSHub, LLM endpoint) cannot be
// pointed at internal services. http://localhost stays allowed for local development.
export function validateExternalUrl(url: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL: "${url}"`);
  }

  // URL.hostname keeps the brackets of IPv6 literals, which would defeat the prefix checks below.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLocalhost) return;

  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must use https for non-local URLs (got: "${url}")`);
  }

  const privatePatterns = [/^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^169\.254\./, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i];
  if (privatePatterns.some((p) => p.test(hostname))) {
    throw new Error(`${label} points to a private/internal address: "${hostname}"`);
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function isRetryable(error: Error): boolean {
  if (error instanceof HttpStatusError) return error.status === 429 || error.status >= 500;
  // fetch rejects with TypeError on network failure; the signal rejects with TimeoutError.
  return error instanceof TypeError || error.name === 'TimeoutError';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string, opts: FetchFeedOptions): Promise<string> {
  return pRetry(
    async () => {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        headers: {
          'User-Agent': opts.userAgent ?? 'Sophon/1.0',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5',
        },
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new HttpStatusError(res.status, url, parseRetryAfter(res.headers.get('retry-after')));
      }
      return res.text();
    },
    {
      retries: opts.retries ?? DEFAULT_RETRIES,
      minTimeout: opts.minRetryDelayMs ?? DEFAULT_MIN_RETRY_DELAY_MS,
      shouldRetry: ({ error }) => isRetryable(error),
      // The server's own Retry-After is more accurate than the exponential backoff alone.
      onFailedAttempt: async ({ error }) => {
        if (error instanceof HttpStatusError && error.retryAfterMs && isRetryable(error)) {
          await sleep(Math.min(error.retryAfterMs, MAX_RETRY_AFTER_MS));
        }
      },
    },
  );
}

interface RawItem {
  title: string | undefined;
  link: string | undefined;
  date: string | undefined;
}

function extractItems(xml: string): RawItem[] {
  const parsed = parseFeed(xml);
  switch (parsed.format) {
    case 'rss':
      return (parsed.feed.items ?? []).map((i) => ({
        title: i.title,
        link: i.link,
        date: i.pubDate ?? i.dc?.dates?.[0],
      }));
    case 'rdf':
      return (parsed.feed.items ?? []).map((i) => ({ title: i.title, link: i.link, date: i.dc?.dates?.[0] }));
    case 'atom':
      return (parsed.feed.entries ?? []).map((e) => ({
        title: e.title?.value,
        link: (e.links?.find((l) => !l.rel || l.rel === 'alternate') ?? e.links?.[0])?.href,
        date: e.published ?? e.updated,
      }));
    case 'json':
      return (parsed.feed.items ?? []).map((i) => ({ title: i.title, link: i.url, date: i.date_published }));
  }
}

function toIsoOrNow(date: string | undefined): string {
  const d = date ? new Date(date) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export async function fetchFeed(url: string, opts: FetchFeedOptions = {}): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  for (const raw of extractItems(await fetchText(url, opts))) {
    const title = raw.title?.trim();
    const link = raw.link?.trim();
    // Rejects javascript: and similar schemes before they reach a rendered href.
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    items.push({ id: articleId(link, title), title, url: link, publishedAt: toIsoOrNow(raw.date) });
  }
  return items;
}

export async function collectFeeds<S extends FeedSource, T extends { id: string; publishedAt: string }>(
  opts: CollectFeedsOptions<S, T>,
): Promise<T[]> {
  const { sources, existing, seenIds = [], failedSources, limit, toRecord } = opts;
  const ids = new Set([...existing.map((a) => a.id), ...seenIds]);

  const results = await Promise.allSettled(sources.map((src) => fetchFeed(src.url, opts.fetchOptions)));

  const fresh: T[] = [];
  const reasons: string[] = [];
  for (const [i, result] of results.entries()) {
    const src = sources[i]!;
    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      reasons.push(reason);
      failedSources?.push(src.source);
      console.error(`  RSS failed (${src.source}):`, reason);
      continue;
    }
    // Dedupe in source order so the same article seen in two feeds is attributed to the first.
    for (const item of result.value) {
      if (ids.has(item.id)) continue;
      ids.add(item.id);
      fresh.push(toRecord(item, src));
    }
    console.log(`  ${src.source}: ${result.value.length} items`);
  }

  // A run where every feed failed must not look like a success, or CI would commit stale data as green.
  if (sources.length > 0 && reasons.length === sources.length) {
    throw new Error(`All ${sources.length} RSS sources failed: ${[...new Set(reasons)].join('; ')}`);
  }

  return [...fresh, ...existing]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

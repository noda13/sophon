import Parser from 'rss-parser';
import { createHash } from 'crypto';
import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';

/**
 * Checks that a URL is safe to use as an external RSS/API endpoint.
 * Allows https (always) and http for localhost only.
 * Blocks RFC-1918 / link-local addresses to prevent SSRF.
 */
function isSafeExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const h = parsed.hostname;
    const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '::1';
    if (!isLocal && parsed.protocol !== 'https:') return false;
    if (!isLocal && /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|fc00:|fe80:)/i.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

export interface RawIssue {
  sourceId: string;
  source: string;
  sourceType: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: Date;
  rawContent: string;
}

interface RssSource {
  url: string;
  source: string;
  sourceType: string;
}

const feedParser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'IssueRadar/1.0 (RSS Reader)',
  },
});

const RSS_SOURCES: RssSource[] = [
  // 国内ニュース
  {
    url: 'https://news.yahoo.co.jp/rss/topics/domestic.xml',
    source: 'yahoo_domestic',
    sourceType: 'news_jp',
  },
  { url: 'https://www.asahi.com/rss/asahi/newsheadlines.rdf', source: 'asahi', sourceType: 'news_jp' },
  { url: 'https://www.nhk.or.jp/rss/news/cat0.xml', source: 'nhk', sourceType: 'news_jp' },
  { url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', source: 'nikkei', sourceType: 'news_jp' },
  // 海外ニュース
  { url: 'https://feeds.reuters.com/reuters/worldNews', source: 'reuters', sourceType: 'news_global' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'bbc', sourceType: 'news_global' },
  { url: 'https://www.theguardian.com/world/rss', source: 'guardian', sourceType: 'news_global' },
  {
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    source: 'nyt',
    sourceType: 'news_global',
  },
  // 政府・公的機関
  { url: 'https://www.cao.go.jp/rss.xml', source: 'cao', sourceType: 'gov' },
  // Twitter via RSSHub (skipped if rsshubUrl is not a safe external URL)
  ...(isSafeExternalUrl(config.rsshubUrl) ? [
    { url: `${config.rsshubUrl}/twitter/user/nhk_news`, source: 'x_nhk_news', sourceType: 'twitter' },
    { url: `${config.rsshubUrl}/twitter/user/jijicom`, source: 'x_jijicom', sourceType: 'twitter' },
  ] : (() => {
    console.warn(`[IssueCollector] RSSHUB_URL "${config.rsshubUrl}" is unsafe (must be https or localhost); RSSHub sources skipped.`);
    return [];
  })()),
];

function buildSourceId(url: string, title: string): string {
  const raw = `${url}:${title.slice(0, 32)}`;
  return createHash('sha256').update(raw).digest('hex');
}

interface FeedItem {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
}

async function fetchFeed(rssSource: RssSource): Promise<RawIssue[]> {
  const feed = await feedParser.parseURL(rssSource.url);
  const items: RawIssue[] = [];

  for (const item of feed.items as FeedItem[]) {
    const title = item.title?.trim() ?? '';
    const link = item.link ?? item.guid ?? '';
    if (!title || !link) continue;

    const rawDate = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : new Date();
    // Fall back to now if the date is invalid (e.g., malformed RSS date string)
    const publishedAt = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;

    const rawContent = item.contentSnippet ?? item.content ?? item.summary ?? '';

    const sourceId = buildSourceId(link, title);

    items.push({
      sourceId,
      source: rssSource.source,
      sourceType: rssSource.sourceType,
      originalTitle: title,
      originalUrl: link,
      publishedAt,
      rawContent: rawContent.slice(0, 2000), // limit raw content size
    });
  }

  return items;
}

export async function collectIssues(): Promise<{ collected: number; skipped: number }> {
  console.log(`[IssueCollector] Starting collection from ${RSS_SOURCES.length} sources...`);

  const results = await Promise.allSettled(RSS_SOURCES.map((src) => fetchFeed(src)));

  // Collect all new items across all sources
  const allItems: RawIssue[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const src = RSS_SOURCES[i];

    if (result.status === 'rejected') {
      console.error(`[IssueCollector] Failed to fetch ${src.source}: ${String(result.reason)}`);
      continue;
    }

    console.log(`[IssueCollector] ${src.source}: fetched ${result.value.length} items`);
    for (const item of result.value) {
      allItems.push(item);
    }
  }

  if (allItems.length === 0) {
    return { collected: 0, skipped: 0 };
  }

  // Batch-check which sourceIds already exist
  const allSourceIds = allItems.map((item) => item.sourceId);
  const existing = await prisma.issue.findMany({
    where: { sourceId: { in: allSourceIds } },
    select: { sourceId: true },
  });
  const existingSet = new Set(existing.map((e) => e.sourceId));

  const newItems = allItems.filter((item) => !existingSet.has(item.sourceId));
  const skipped = allItems.length - newItems.length;

  let collected = 0;
  if (newItems.length > 0) {
    try {
      const result = await prisma.issue.createMany({
        data: newItems.map((item) => ({
          sourceId: item.sourceId,
          source: item.source,
          sourceType: item.sourceType,
          originalTitle: item.originalTitle,
          originalUrl: item.originalUrl,
          publishedAt: item.publishedAt,
          rawContent: item.rawContent,
          summaryJa: '',
          category: '',
          severityScore: 0,
          urgencyScore: 0,
          appifiabilityScore: 0,
          affectedDomain: '[]',
          proposedAppIdea: '',
          mvpFeatures: '[]',
          targetUsers: '',
          difficulty: '',
        })),
      });
      collected = result.count;
    } catch (error) {
      console.error('[IssueCollector] createMany failed:', String(error));
      throw error;
    }
  }
  console.log(`[IssueCollector] Done. collected=${collected}, skipped=${skipped}`);
  return { collected, skipped };
}

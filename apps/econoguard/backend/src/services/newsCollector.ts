import Parser from 'rss-parser';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Econoguard/1.0',
  },
});

const RSS_SOURCES = [
  // === 速報・一次情報 ===
  { name: 'bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', source: 'bloomberg' },
  // === 市場・投資動向 ===
  { name: 'cnbc', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'cnbc' },
  { name: 'marketwatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'marketwatch' },
  // === 米国コア経済 ===
  { name: 'wsj', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', source: 'wsj' },
  // === 欧州+グローバル視点 ===
  { name: 'ft', url: 'https://www.ft.com/rss/home', source: 'ft' },
  { name: 'economist', url: 'https://www.economist.com/finance-and-economics/rss.xml', source: 'economist' },
  // === 中央銀行（一次ソース） ===
  { name: 'fed', url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'fed' },
  { name: 'ecb', url: 'https://www.ecb.europa.eu/rss/press.html', source: 'ecb' },
  { name: 'boj', url: 'https://www.boj.or.jp/rss/whatsnew.xml', source: 'boj' },
  // === 日本政策 ===
  { name: 'nikkei', url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', source: 'nikkei' },
];

const MAX_ITEMS_PER_FEED = 50;
const EXISTING_LOOKUP_CHUNK_SIZE = 500;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const MAX_RAW_CONTENT_CHARS = 500;

interface RawArticle {
  sourceId: string;
  source: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: Date;
  rawContent?: string;
}

function generateSourceId(url: string, title: string): string {
  return crypto.createHash('sha256').update(`${url}:${title}`).digest('hex').slice(0, 32);
}

function normalizeRawContent(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const text = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, MAX_RAW_CONTENT_CHARS) : undefined;
}

function parsePublishedAt(raw: string | undefined): Date {
  const now = new Date();
  if (!raw) return now;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() - now.getTime() > MAX_FUTURE_SKEW_MS) {
    return now;
  }
  return parsed;
}

interface FetchResult {
  articles: RawArticle[];
  failed: number;
  total: number;
}

async function fetchRSS(): Promise<FetchResult> {
  const articles: RawArticle[] = [];

  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (rssSource) => {
      console.log(`Fetching RSS: ${rssSource.name}...`);
      const feed = await parser.parseURL(rssSource.url);
      const items: RawArticle[] = [];

      for (const item of (feed.items || []).slice(0, MAX_ITEMS_PER_FEED)) {
        if (!item.title || !item.link) continue;

        items.push({
          sourceId: generateSourceId(item.link, item.title),
          source: rssSource.source,
          originalTitle: item.title,
          originalUrl: item.link,
          publishedAt: parsePublishedAt(item.pubDate),
          rawContent: normalizeRawContent(item.contentSnippet || item.content),
        });
      }

      if (items.length === 0) {
        console.warn(`RSS feed ${rssSource.name} returned 0 items`);
      }
      console.log(`  -> ${items.length} articles from ${rssSource.name}`);
      return items;
    }),
  );

  let failed = 0;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    } else {
      failed++;
      const reason = result.reason instanceof Error ? result.reason.message : result.reason;
      console.error(`Failed to fetch RSS from ${RSS_SOURCES[i].name}: ${reason}`);
    }
  });

  return { articles, failed, total: RSS_SOURCES.length };
}

async function fetchNewsAPI(): Promise<{ articles: RawArticle[]; failed: boolean }> {
  if (!config.newsApiKey) {
    console.log('NewsAPI key not configured, skipping');
    return { articles: [], failed: false };
  }

  const articles: RawArticle[] = [];
  const keywords = ['economy crisis', 'trade war', 'inflation', 'central bank', 'financial risk', 'CBDC', 'tariff'];
  const query = keywords.join(' OR ');

  try {
    console.log('Fetching NewsAPI...');
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.set('q', query);
    url.searchParams.set('language', 'en');
    url.searchParams.set('sortBy', 'publishedAt');
    url.searchParams.set('pageSize', '20');
    url.searchParams.set('apiKey', config.newsApiKey);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`NewsAPI responded with ${response.status}`);
    }

    const data = await response.json() as {
      articles?: Array<{
        title?: string;
        url?: string;
        publishedAt?: string;
        description?: string;
        source?: { name?: string };
      }>;
    };

    for (const item of data.articles || []) {
      if (!item.title || !item.url) continue;

      articles.push({
        sourceId: generateSourceId(item.url, item.title),
        source: `newsapi_${(item.source?.name || 'unknown').toLowerCase().replace(/\s+/g, '_')}`,
        originalTitle: item.title,
        originalUrl: item.url,
        publishedAt: parsePublishedAt(item.publishedAt),
        rawContent: normalizeRawContent(item.description),
      });
    }

    console.log(`  -> ${articles.length} articles from NewsAPI`);
  } catch (error) {
    console.error('Failed to fetch NewsAPI:', error instanceof Error ? error.message : error);
    return { articles, failed: true };
  }

  return { articles, failed: false };
}

export interface NewsCollectionResult {
  collected: number;
  skipped: number;
  feedsFailed: number;
  feedsTotal: number;
}

export async function collectNews(): Promise<NewsCollectionResult> {
  const [rss, newsApi] = await Promise.all([
    fetchRSS(),
    fetchNewsAPI(),
  ]);

  const bySourceId = new Map<string, RawArticle>();
  for (const article of [...rss.articles, ...newsApi.articles]) {
    if (!bySourceId.has(article.sourceId)) bySourceId.set(article.sourceId, article);
  }
  const allArticles = [...bySourceId.values()];

  const existingSourceIds = new Set<string>();
  for (let i = 0; i < allArticles.length; i += EXISTING_LOOKUP_CHUNK_SIZE) {
    const chunk = allArticles.slice(i, i + EXISTING_LOOKUP_CHUNK_SIZE).map((a) => a.sourceId);
    const rows = await prisma.newsArticle.findMany({
      where: { sourceId: { in: chunk } },
      select: { sourceId: true },
    });
    for (const row of rows) existingSourceIds.add(row.sourceId);
  }

  const newArticles = allArticles
    .filter((article) => !existingSourceIds.has(article.sourceId))
    .map((article) => ({
      sourceId: article.sourceId,
      source: article.source,
      originalTitle: article.originalTitle,
      originalUrl: article.originalUrl,
      publishedAt: article.publishedAt,
      rawContent: article.rawContent ?? null,
      summaryJa: '',
      relevanceScore: 0,
      riskCategories: '[]',
    }));

  let collected = 0;
  let skipped = allArticles.length - newArticles.length;

  if (newArticles.length > 0) {
    try {
      const result = await prisma.newsArticle.createMany({ data: newArticles });
      collected = result.count;
    } catch (error) {
      console.error(
        'Bulk insert failed, falling back to per-row inserts:',
        error instanceof Error ? error.message : error,
      );
      for (const data of newArticles) {
        try {
          await prisma.newsArticle.create({ data });
          collected++;
        } catch (rowError) {
          console.error('Failed to save article:', rowError instanceof Error ? rowError.message : rowError);
          skipped++;
        }
      }
    }
  }

  console.log(`News collection complete: ${collected} new, ${skipped} skipped`);
  const newsApiConfigured = config.newsApiKey ? 1 : 0;
  return {
    collected,
    skipped,
    feedsFailed: rss.failed + (newsApi.failed ? 1 : 0),
    feedsTotal: rss.total + newsApiConfigured,
  };
}

import type { NewsArticle } from '../../../shared/schema/econ';
import type { FeedItem, FeedSource } from '../../core/rss';

export const ECON_FEEDS: readonly FeedSource[] = [
  { url: 'https://feeds.bloomberg.com/markets/news.rss', source: 'bloomberg' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'cnbc' },
  { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'marketwatch' },
  { url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', source: 'wsj' },
  { url: 'https://www.ft.com/rss/home', source: 'ft' },
  { url: 'https://www.economist.com/finance-and-economics/rss.xml', source: 'economist' },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'fed' },
  { url: 'https://www.ecb.europa.eu/rss/press.html', source: 'ecb' },
  { url: 'https://www.boj.or.jp/rss/whatsnew.xml', source: 'boj' },
  { url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', source: 'nikkei' },
];

export const MAX_NEWS = 200;

export function toNewsArticle(item: FeedItem, feed: FeedSource): NewsArticle {
  return {
    id: item.id,
    source: feed.source,
    originalTitle: item.title,
    originalUrl: item.url,
    publishedAt: item.publishedAt,
    summaryJa: '',
    relevanceScore: 0,
    riskCategories: [],
  };
}

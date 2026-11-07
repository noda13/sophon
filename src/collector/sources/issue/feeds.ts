import { createHash } from 'node:crypto';
import type { FeedItem, FeedSource } from '../../core/rss';
import { validateExternalUrl } from '../../core/rss';
import type { Issue } from '../../../shared/schema/issue';

export const ISSUE_RETENTION = 300;

export type IssueSourceType = Issue['sourceType'];

export interface IssueFeed extends FeedSource {
  sourceType: IssueSourceType;
}

// reuters（DNS 不可）と cao（404）は実測で取得できないため定義に含めない。
export function buildFeeds(env: NodeJS.ProcessEnv): IssueFeed[] {
  // GitHub Actions は未設定の secret を空文字で渡す。
  const rsshubUrl = env.RSSHUB_URL?.trim();
  if (rsshubUrl) validateExternalUrl(rsshubUrl, 'RSSHUB_URL');
  const rsshub = rsshubUrl?.replace(/\/+$/, '');
  return [
    { url: 'https://news.yahoo.co.jp/rss/topics/domestic.xml', source: 'yahoo_domestic', sourceType: 'news_jp' },
    { url: 'https://www.asahi.com/rss/asahi/newsheadlines.rdf', source: 'asahi', sourceType: 'news_jp' },
    { url: 'https://www.nhk.or.jp/rss/news/cat0.xml', source: 'nhk', sourceType: 'news_jp' },
    { url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', source: 'nikkei', sourceType: 'news_jp' },
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'bbc', sourceType: 'news_global' },
    { url: 'https://www.theguardian.com/world/rss', source: 'guardian', sourceType: 'news_global' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'nyt', sourceType: 'news_global' },
    // 公開の rsshub.app は twitter ルートを 404 で返すため、自前のインスタンスがあるときだけ使う。
    ...(rsshub
      ? ([
          { url: `${rsshub}/twitter/user/nhk_news`, source: 'x_nhk_news', sourceType: 'twitter' },
          { url: `${rsshub}/twitter/user/jijicom`, source: 'x_jijicom', sourceType: 'twitter' },
        ] satisfies IssueFeed[])
      : []),
  ];
}

// 旧データの id は sha256 の先頭 32 桁。core の articleId（16 桁）の接頭辞なので、
// 新規分は 32 桁で作り、既存分との重複判定には 16 桁の接頭辞を seenIds として渡す。
export function issueId(url: string, title: string): string {
  return createHash('sha256').update(`${url}:${title}`).digest('hex').slice(0, 32);
}

export function seenIdsOf(existing: readonly Pick<Issue, 'id'>[]): string[] {
  return existing.map((i) => i.id.slice(0, 16));
}

export function newIssue(item: FeedItem, feed: IssueFeed, now: Date): Issue {
  return {
    id: issueId(item.url, item.title),
    source: feed.source,
    sourceType: feed.sourceType,
    originalTitle: item.title,
    originalUrl: item.url,
    publishedAt: item.publishedAt,
    rawContent: item.summary,
    summaryJa: '',
    category: '',
    severityScore: 0,
    urgencyScore: 0,
    appifiabilityScore: 0,
    affectedDomain: [],
    classifiedAt: null,
    proposedAppIdea: '',
    mvpFeatures: [],
    targetUsers: '',
    difficulty: '',
    ideaGeneratedAt: null,
    createdAt: now.toISOString(),
  };
}

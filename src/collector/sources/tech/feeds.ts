import type { TechCategory } from '../../../shared/schema/tech';
import type { FeedSource } from '../../core/rss';

export interface TechFeed extends FeedSource {
  /** LLM が最終判断するまでの仮カテゴリ。 */
  hint: TechCategory;
}

// anthropic（https://www.anthropic.com/rss.xml）は 404、openai（https://openai.com/news/rss/）は 403 を返すため外してある。
export const TECH_FEEDS: readonly TechFeed[] = [
  { url: 'https://hnrss.org/frontpage', source: 'hackernews', hint: 'trend' },
  { url: 'https://zenn.dev/feed', source: 'zenn', hint: 'trend' },
  { url: 'https://qiita.com/popular-items/feed', source: 'qiita', hint: 'trend' },
  { url: 'https://www.publickey1.jp/atom.xml', source: 'publickey', hint: 'trend' },
  { url: 'https://github.blog/engineering.atom', source: 'github-blog', hint: 'trend' },
  { url: 'https://gigazine.net/news/rss_2.0/', source: 'gigazine', hint: 'trend' },
  { url: 'https://www.techmeme.com/feed.xml', source: 'techmeme', hint: 'trend' },
  { url: 'https://blog.google/technology/ai/rss/', source: 'google-ai', hint: 'ai' },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'huggingface', hint: 'ai' },
  { url: 'https://export.arxiv.org/rss/cs.AI', source: 'arxiv-ai', hint: 'ai' },
  { url: 'https://www.jpcert.or.jp/rss/jpcert.rdf', source: 'jpcert', hint: 'security' },
  // feed が全履歴を含み、デコード後で約 5.6 MB と既定の 5 MiB を超えるため。
  { url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', source: 'cisa', hint: 'security', maxBytes: 10 * 1024 * 1024 },
  { url: 'https://feeds.feedburner.com/TheHackersNews', source: 'the-hacker-news', hint: 'security' },
  { url: 'https://www.bleepingcomputer.com/feed/', source: 'bleepingcomputer', hint: 'security' },
  { url: 'https://nodejs.org/en/feed/blog.xml', source: 'nodejs', hint: 'release' },
  { url: 'https://kubernetes.io/feed.xml', source: 'kubernetes', hint: 'release' },
  { url: 'https://aws.amazon.com/blogs/aws/feed/', source: 'aws', hint: 'release' },
  { url: 'https://github.com/vitejs/vite/releases.atom', source: 'vite', hint: 'release' },
  { url: 'https://github.com/denoland/deno/releases.atom', source: 'deno', hint: 'release' },
];

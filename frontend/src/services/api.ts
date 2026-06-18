import { CATEGORIES } from '../lib/categories';
import type { Category } from '../lib/categories';

async function fetchStaticJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const base = import.meta.env.BASE_URL;
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const res = await fetch(`${normalizedBase}data/${filename}`);
    if (!res.ok) return fallback;
    return await res.json() as T;
  } catch {
    return fallback;
  }
}

export interface Article {
  id: string;
  source: string;
  category: Category;
  importance: '高' | '中' | '低';
  originalTitle: string;
  originalUrl: string;
  publishedAt: string; // ISO
  summaryJa: string;
}

export interface EolItem {
  product: string;
  cycle: string;
  eol: string | false;
  latest?: string;
  daysLeft: number; // negative = already EOL
}

export interface DigestHighlight {
  title: string;
  summaryJa: string;
  url: string;
}

export interface DigestSection {
  category: Category;
  highlights: DigestHighlight[];
}

export interface Digest {
  date: string;
  generatedAt: string;
  overviewJa: string;
  sections: DigestSection[];
}

export interface Meta {
  lastUpdated: string;
  latestDigestDate?: string;
}

export const fetchArticles = (category?: Category, limit = 50): Promise<Article[]> =>
  fetchStaticJson<Article[]>('articles.json', []).then(all => {
    const summarized = all
      .filter(a => (a.summaryJa?.length ?? 0) > 0)
      .filter(a => (CATEGORIES as readonly string[]).includes(a.category));
    const filtered = category ? summarized.filter(a => a.category === category) : summarized;
    return filtered.slice(0, limit);
  });

export const fetchDigest = (date?: string): Promise<Digest> => {
  const filename = date ? `digest/${date}.json` : 'digest-latest.json';
  return fetchStaticJson<Digest>(filename, {
    date: '',
    generatedAt: '',
    overviewJa: '',
    sections: [],
  });
};

export const fetchEol = (): Promise<EolItem[]> =>
  fetchStaticJson<EolItem[]>('eol.json', []);

export const fetchMeta = (): Promise<Meta> =>
  fetchStaticJson<Meta>('meta.json', { lastUpdated: '' });

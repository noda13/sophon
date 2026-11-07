import axios from 'axios';
import { filterRecentHistory } from '../lib/history';
import type { Meta } from '../lib/runHealth';

// Detect if running in static mode (GitHub Pages)
const isStatic = import.meta.env.VITE_STATIC_DATA === 'true';

const api = axios.create({
  baseURL: '/api',
  // Prevent requests from hanging indefinitely on a stalled backend
  timeout: 10000,
});

// Normalize axios errors into a consistent shape so callers get a
// meaningful message without needing to inspect AxiosError internals.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status: number | undefined =
      axios.isAxiosError(error) ? error.response?.status : undefined;
    const message: string =
      axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message ?? error.message
        : String(error);
    return Promise.reject(Object.assign(new Error(message), { status }));
  },
);

export interface NewsArticle {
  id: number | string;
  sourceId?: string;
  source: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;
  summaryJa: string;
  relevanceScore: number;
  riskCategories: string[];
  createdAt?: string;
}

export interface RiskAssessment {
  id?: number;
  category: string;
  score: number;
  level: string;
  summaryJa: string;
  factorsJa: string[];
  assessedAt: string;
  createdAt?: string;
  delta?: number;
  changeReasonJa?: string;
  sourceNewsIds?: string[];
}

// ---------------------------------------------------------------------------
// Normalization helpers — parse backend values that may arrive as either a
// JSON-encoded string or an already-decoded array into a plain string[].
// ---------------------------------------------------------------------------

function toStringArray(value: string | string[] | undefined | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [value];
  } catch {
    return [value];
  }
}

function normalizeNewsArticle(raw: NewsArticle & { riskCategories: string | string[] }): NewsArticle {
  return { ...raw, riskCategories: toStringArray(raw.riskCategories) };
}

function normalizeRiskAssessment(raw: RiskAssessment & { factorsJa: string | string[] }): RiskAssessment {
  return { ...raw, factorsJa: toStringArray(raw.factorsJa) };
}

export interface EconomicIndicator {
  id?: number;
  code: string;
  name: string;
  value: number;
  previousValue: number | null;
  unit: string;
  source: string;
  recordedAt: string;
  stale?: boolean;
}

export interface CompositeRisk {
  compositeScore: number;
  level: string;
  breakdown: Array<{
    category: string;
    score: number;
    weight: number;
  }>;
  delta?: number;
}

// --- Static JSON fetchers ---

async function fetchStaticJson<T>(filename: string): Promise<T> {
  const base = import.meta.env.BASE_URL || '/';
  const res = await fetch(`${base}data/${filename}`);
  if (!res.ok) throw new Error(`Failed to load ${filename} (${res.status})`);
  return (await res.json()) as T;
}

// --- API functions ---

export const fetchNews = async (limit = 20, category?: string): Promise<NewsArticle[]> => {
  if (isStatic) {
    const all = (await fetchStaticJson<NewsArticle[]>('news.json')).map(normalizeNewsArticle);
    const matched = category ? all.filter((a) => a.riskCategories.includes(category)) : all;
    return matched.slice(0, limit);
  }
  const params: Record<string, string> = { limit: String(limit) };
  if (category) params.category = category;
  const { data } = await api.get<NewsArticle[]>('/news', { params });
  return data.map(normalizeNewsArticle);
};

export const fetchRisks = async (): Promise<RiskAssessment[]> => {
  if (isStatic) {
    const all = await fetchStaticJson<RiskAssessment[]>('risks.json');
    return all.map(normalizeRiskAssessment);
  }
  const { data } = await api.get<RiskAssessment[]>('/risks');
  return data.map(normalizeRiskAssessment);
};

export const fetchRiskHistory = async (category: string, days = 30): Promise<RiskAssessment[]> => {
  if (isStatic) {
    const history = await fetchStaticJson<Record<string, RiskAssessment[]>>('risk-history.json');
    return filterRecentHistory(history[category] || [], days).map(normalizeRiskAssessment);
  }
  const { data } = await api.get<RiskAssessment[]>(`/risks/${category}`, { params: { days } });
  return data.map(normalizeRiskAssessment);
};

export const fetchIndicators = async (): Promise<EconomicIndicator[]> => {
  if (isStatic) {
    return fetchStaticJson<EconomicIndicator[]>('indicators.json');
  }
  const { data } = await api.get('/indicators');
  return data;
};

export const fetchCompositeRisk = async (): Promise<CompositeRisk> => {
  if (isStatic) {
    return fetchStaticJson<CompositeRisk>('composite-risk.json');
  }
  const { data } = await api.get('/risks/composite');
  return data;
};

export const fetchMeta = async (): Promise<Meta | undefined> => {
  if (!isStatic) return undefined;
  try {
    return await fetchStaticJson<Meta>('meta.json');
  } catch {
    return undefined;
  }
};

export interface EconomicEvent {
  date: string;        // ISO date string (YYYY-MM-DD)
  titleJa: string;     // Japanese title e.g. "FOMC政策金利発表"
  region: 'US' | 'JP' | 'EU' | 'GLOBAL';
  importance: 'high' | 'medium';
}

export const fetchEvents = (): Promise<EconomicEvent[]> => fetchStaticJson<EconomicEvent[]>('events.json');

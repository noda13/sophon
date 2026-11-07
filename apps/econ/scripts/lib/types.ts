// Lives here (not in summarize.ts) so news.ts can use it without importing the LLM client.
export const MAX_SUMMARY_ATTEMPTS = 3;

export interface RunHealth {
  sources: { total: number; failed: string[] };
  summaries: { attempted: number; failed: number };
  assessment: 'ok' | 'failed' | 'skipped';
}

export interface NewsArticle {
  id: string;
  source: string;
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;
  summaryJa: string;
  relevanceScore: number;
  riskCategories: string[];
  summaryAttempts?: number;
}

export interface EconomicIndicator {
  code: string;
  name: string;
  value: number;
  previousValue: number | null;
  unit: string;
  source: string;
  recordedAt: string;
  stale?: boolean;
}

export interface RiskAssessment {
  category: string;
  score: number;
  level: string;
  summaryJa: string;
  factorsJa: string[];
  assessedAt: string;
  delta?: number;
  changeReasonJa?: string;
  sourceNewsIds?: string[];
}

export interface CompositeRisk {
  compositeScore: number;
  level: string;
  breakdown: Array<{ category: string; score: number; weight: number }>;
  delta?: number;
}

export interface Issue {
  id: number;
  sourceId: string;
  source: string;
  sourceType: 'twitter' | 'news_jp' | 'news_global' | 'gov';
  originalTitle: string;
  originalUrl: string;
  publishedAt: string;
  rawContent: string;
  summaryJa: string;
  category: string;
  severityScore: number;
  urgencyScore: number;
  appifiabilityScore: number;
  affectedDomain: string[];
  classifiedAt: string | null;
  proposedAppIdea: string;
  mvpFeatures: string[];
  targetUsers: string;
  difficulty: 'low' | 'medium' | 'high' | '';
  ideaGeneratedAt: string | null;
  createdAt: string;
}

export type IdeaSummary = Issue & {
  appifiabilityScore: number; // >= 60
  ideaGeneratedAt: string;    // not null
};

export interface CategorySummary {
  category: string;
  count: number;
  avgSeverity: number;
  avgAppifiability: number;
}

export interface MetaInfo {
  lastUpdated: string;
}

import { z } from 'zod';

export const ISSUE_CATEGORIES = [
  'employment_economy',
  'healthcare_welfare',
  'education',
  'childcare_family',
  'aging_care',
  'governance',
  'environment_disaster',
  'community_regional',
] as const;
export const IssueCategorySchema = z.enum(ISSUE_CATEGORIES);
export type IssueCategory = z.infer<typeof IssueCategorySchema>;

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  employment_economy: '雇用・経済',
  healthcare_welfare: '医療・福祉',
  education: '教育・学習',
  childcare_family: '子育て・家族',
  aging_care: '高齢化・介護',
  governance: '行政・制度',
  environment_disaster: '環境・防災',
  community_regional: '地方・コミュニティ',
};

// アイデア生成の対象にする appifiabilityScore の下限
export const IDEA_MIN_APPIFIABILITY = 60;

export const SourceTypeSchema = z.enum(['twitter', 'news_jp', 'news_global', 'gov']);
export const DifficultySchema = z.enum(['low', 'medium', 'high']);

// category と difficulty は未分類・未生成の間は空文字で書き出される。
export const IssueSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceType: SourceTypeSchema,
  originalTitle: z.string(),
  originalUrl: z.string(),
  publishedAt: z.string(),
  rawContent: z.string(),
  summaryJa: z.string(),
  category: z.union([IssueCategorySchema, z.literal('')]),
  severityScore: z.number(),
  urgencyScore: z.number(),
  appifiabilityScore: z.number(),
  affectedDomain: z.array(z.string()),
  classifiedAt: z.string().nullable(),
  proposedAppIdea: z.string(),
  mvpFeatures: z.array(z.string()),
  targetUsers: z.string(),
  difficulty: z.union([DifficultySchema, z.literal('')]),
  ideaGeneratedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const IdeaSchema = IssueSchema.extend({
  appifiabilityScore: z.number().min(IDEA_MIN_APPIFIABILITY),
  ideaGeneratedAt: z.string(),
});

export const CategorySummarySchema = z.object({
  category: IssueCategorySchema,
  count: z.number(),
  avgSeverity: z.number(),
  avgAppifiability: z.number(),
});

export const IssuesFileSchema = z.array(IssueSchema);
export const IdeasFileSchema = z.array(IdeaSchema);
export const CategorySummaryFileSchema = z.array(CategorySummarySchema);

export type Issue = z.infer<typeof IssueSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type CategorySummary = z.infer<typeof CategorySummarySchema>;

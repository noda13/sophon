import { z } from 'zod';

// 画面のタブがこの順で並ぶ。tech はセキュリティリスクの把握が目的なので security を先頭にする。
export const TECH_CATEGORIES = ['security', 'trend', 'ai', 'release'] as const;
export const TechCategorySchema = z.enum(TECH_CATEGORIES);
export type TechCategory = z.infer<typeof TechCategorySchema>;

export const TECH_CATEGORY_META: Record<TechCategory, { label: string; color: string; description: string }> = {
  trend: { label: '技術トレンド', color: 'blue', description: '開発・技術の最新動向' },
  ai: { label: 'AI / LLM', color: 'purple', description: 'AI・機械学習・LLMの動向' },
  security: { label: 'セキュリティ', color: 'red', description: '脆弱性・セキュリティインシデント' },
  release: { label: 'リリース / 更新', color: 'green', description: '製品・OSS・SaaSのリリース情報' },
};

// eol が false（サポート終了日なし）の製品を並べ替えで末尾に送るための daysLeft。
export const EOL_NO_DATE_DAYS = 9999;

export const ImportanceSchema = z.enum(['高', '中', '低']);

export const ArticleSchema = z.object({
  id: z.string(),
  source: z.string(),
  category: TechCategorySchema,
  importance: ImportanceSchema,
  originalTitle: z.string(),
  originalUrl: z.string(),
  publishedAt: z.string(),
  summaryJa: z.string(),
  // 要約に失敗した回数。collector が上限で打ち切るために持つ。成功すると消える。
  summaryAttempts: z.number().int().min(0).optional(),
});

export const EolItemSchema = z.object({
  product: z.string(),
  cycle: z.string(),
  eol: z.union([z.string(), z.literal(false)]),
  latest: z.string().optional(),
  // 負の値はすでに EOL を過ぎている
  daysLeft: z.number(),
});

export const DigestHighlightSchema = z.object({
  title: z.string(),
  summaryJa: z.string(),
  url: z.string(),
});

export const DigestSectionSchema = z.object({
  category: TechCategorySchema,
  highlights: z.array(DigestHighlightSchema),
});

export const DigestSchema = z.object({
  date: z.string(),
  generatedAt: z.string(),
  overviewJa: z.string(),
  sections: z.array(DigestSectionSchema),
});

export const DIGEST_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 新しい順。digest/<date>.json の一覧を画面が持つための索引
export const DigestIndexSchema = z.object({
  dates: z.array(z.string().regex(DIGEST_DATE_PATTERN)),
});

export const ArticlesFileSchema = z.array(ArticleSchema);
export const EolFileSchema = z.array(EolItemSchema);

export type Article = z.infer<typeof ArticleSchema>;
export type EolItem = z.infer<typeof EolItemSchema>;
export type Digest = z.infer<typeof DigestSchema>;
export type DigestIndex = z.infer<typeof DigestIndexSchema>;

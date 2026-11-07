import { z } from 'zod';
import { TechCategorySchema } from '../../../shared/schema/tech';

// 不正な値は URL を手で書き換えた結果なので、エラーにせず未指定として扱う
export const articlesSearchSchema = z.object({
  category: TechCategorySchema.optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
});
export type ArticlesSearch = z.output<typeof articlesSearchSchema>;

export const digestSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});
export type DigestSearch = z.output<typeof digestSearchSchema>;

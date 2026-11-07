import { z } from 'zod';
import { DifficultySchema, SourceTypeSchema } from '../../../../shared/schema/issue';
import { CategoryFilterSchema, IssueSortSchema } from './issues';

// 不正な値は未指定に落とす。URL を手で書き換えても画面が壊れないようにするため
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const IssuesSearchSchema = z.object({
  category: lenient(CategoryFilterSchema),
  sourceType: lenient(SourceTypeSchema),
  sort: lenient(IssueSortSchema),
  page: lenient(z.number().int().min(1)),
});
export type IssuesSearch = z.output<typeof IssuesSearchSchema>;

export const IdeasSearchSchema = z.object({
  category: lenient(CategoryFilterSchema),
  difficulty: lenient(DifficultySchema),
  sort: lenient(IssueSortSchema),
  page: lenient(z.number().int().min(1)),
});
export type IdeasSearch = z.output<typeof IdeasSearchSchema>;

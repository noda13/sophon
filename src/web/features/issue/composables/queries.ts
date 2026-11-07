import { sourceQueryOptions } from '../../../composables/useSourceQuery';
import { AnyMetaSchema } from '../../../../shared/schema/meta';
import {
  CategorySummaryFileSchema,
  IdeasFileSchema,
  IssuesFileSchema,
} from '../../../../shared/schema/issue';

// ルートの loader での先読みと、composable での取得が同じキーを共有するよう、options はここに集める
export const issuesQuery = sourceQueryOptions('issue', 'issues.json', IssuesFileSchema);
export const ideasQuery = sourceQueryOptions('issue', 'ideas.json', IdeasFileSchema);
export const categorySummaryQuery = sourceQueryOptions('issue', 'category-summary.json', CategorySummaryFileSchema);
export const issueMetaQuery = sourceQueryOptions('issue', 'meta.json', AnyMetaSchema);

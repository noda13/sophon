import {
  ISSUE_CATEGORIES,
  type CategorySummary,
  type IssueCategory,
} from '../../../../shared/schema/issue';
import { type ScoreTone, scoreTone } from '../../../ui/ScoreBadge';
import { categoryLabel } from './format';

export interface HeatmapCell {
  category: IssueCategory;
  label: string;
  count: number;
  avgSeverity: number;
  avgAppifiability: number;
  severityTone: ScoreTone;
  appifiabilityTone: ScoreTone;
  // 件数の最大値に対する比率（0〜1）。色の濃さに使う
  intensity: number;
}

// 収集結果に出てこないカテゴリも 0 件のセルとして並べ、画面上の配置を固定する
export function buildHeatmapCells(summaries: readonly CategorySummary[]): HeatmapCell[] {
  const byCategory = new Map(summaries.map((s) => [s.category, s]));
  const maxCount = Math.max(0, ...summaries.map((s) => s.count));

  return ISSUE_CATEGORIES.map((category) => {
    const s = byCategory.get(category);
    const count = s?.count ?? 0;
    const avgSeverity = s?.avgSeverity ?? 0;
    const avgAppifiability = s?.avgAppifiability ?? 0;
    return {
      category,
      label: categoryLabel(category),
      count,
      avgSeverity,
      avgAppifiability,
      severityTone: scoreTone(avgSeverity),
      // 深刻度と違い、アプリ化スコアは高いほど望ましい
      appifiabilityTone: scoreTone(avgAppifiability, true),
      intensity: maxCount === 0 ? 0 : count / maxCount,
    };
  });
}

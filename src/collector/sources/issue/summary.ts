import { IssueCategorySchema, type CategorySummary, type Issue, type IssueCategory } from '../../../shared/schema/issue';

export function buildCategorySummary(issues: readonly Issue[]): CategorySummary[] {
  const groups = new Map<IssueCategory, Issue[]>();
  for (const issue of issues) {
    const parsed = IssueCategorySchema.safeParse(issue.category);
    if (!parsed.success) continue;
    const group = groups.get(parsed.data) ?? [];
    group.push(issue);
    groups.set(parsed.data, group);
  }

  const mean = (items: Issue[], pick: (i: Issue) => number) =>
    Math.round(items.reduce((sum, i) => sum + pick(i), 0) / items.length);

  return [...groups.entries()]
    .map(([category, items]) => ({
      category,
      count: items.length,
      avgSeverity: mean(items, (i) => i.severityScore),
      avgAppifiability: mean(items, (i) => i.appifiabilityScore),
    }))
    .sort((a, b) => b.count - a.count);
}

import type { SourceId } from '../../../../shared/schema/meta';

export interface SummaryItem {
  label: string;
  value: number;
}

const DISPLAY_KEYS: Record<SourceId, readonly (readonly [key: string, label: string])[]> = {
  stock: [
    ['stocks', '銘柄'],
    ['rankings', 'ランキング'],
  ],
  tech: [
    ['articles', '記事'],
    ['newArticles', '新着'],
    ['eol', 'EOL'],
  ],
  issue: [
    ['issues', '課題'],
    ['newIssues', '新着'],
    ['ideas', 'アイデア'],
  ],
  econ: [
    ['articles', '記事'],
    ['indicators', '指標'],
    ['risks', 'リスク'],
  ],
};

export function summarizeCounts(source: SourceId, counts: Record<string, number>): SummaryItem[] {
  const items: SummaryItem[] = [];
  for (const [key, label] of DISPLAY_KEYS[source]) {
    const value = counts[key];
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) items.push({ label, value });
  }
  return items;
}

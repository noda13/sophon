import { ISSUE_CATEGORY_LABELS, type Issue } from '../../../../shared/schema/issue';

export const SOURCE_TYPE_LABELS: Record<Issue['sourceType'], string> = {
  twitter: 'Twitter',
  news_jp: '国内ニュース',
  news_global: '海外ニュース',
  gov: '政府',
};

export const DIFFICULTY_LABELS = {
  low: '難易度:低',
  medium: '難易度:中',
  high: '難易度:高',
} as const;

export const UNCATEGORIZED_LABEL = '未分類';

export function categoryLabel(category: Issue['category']): string {
  return category === '' ? UNCATEGORIZED_LABEL : ISSUE_CATEGORY_LABELS[category];
}

export function difficultyLabel(difficulty: Issue['difficulty']): string {
  return difficulty === '' ? '難易度:不明' : DIFFICULTY_LABELS[difficulty];
}

export function difficultyTone(difficulty: Issue['difficulty']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (difficulty === 'low') return 'success';
  if (difficulty === 'medium') return 'warning';
  if (difficulty === 'high') return 'danger';
  return 'neutral';
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeDate(dateStr: string, now: Date | number = Date.now()): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '---';
  const nowMs = typeof now === 'number' ? now : now.getTime();
  // 端末の時計が進んでいると公開時刻が未来になるため、0 に丸める
  const sec = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000));
  if (sec < MINUTE) return 'たった今';
  if (sec < HOUR) return `${Math.floor(sec / MINUTE)}分前`;
  if (sec < DAY) return `${Math.floor(sec / HOUR)}時間前`;
  const days = Math.floor(sec / DAY);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}ヶ月前`;
  return `${Math.floor(months / 12)}年前`;
}

export function formatScore(score: number): string {
  return `${Math.round(score)}/100`;
}

import type { ReactNode } from 'react';
import type { Issue } from '../../../../shared/schema/issue';
import { SOURCE_TYPE_LABELS, categoryLabel, difficultyLabel, difficultyTone } from '../logic/format';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-surface-overlay text-fg-muted',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-danger-muted text-danger',
  info: 'bg-info-muted text-info',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Issue['category'] }) {
  return <Badge tone={category === '' ? 'neutral' : 'info'}>{categoryLabel(category)}</Badge>;
}

export function SourceTypeBadge({ sourceType }: { sourceType: Issue['sourceType'] }) {
  return <Badge>{SOURCE_TYPE_LABELS[sourceType]}</Badge>;
}

export function DifficultyBadge({ difficulty }: { difficulty: Issue['difficulty'] }) {
  return <Badge tone={difficultyTone(difficulty)}>{difficultyLabel(difficulty)}</Badge>;
}

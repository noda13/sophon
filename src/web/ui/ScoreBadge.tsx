export type ScoreTone = 'low' | 'moderate' | 'high' | 'critical';

interface ScoreBadgeProps {
  label: string;
  score: number;
  size?: 'sm' | 'md';
  // 値が大きいほど良い指標（stock のスコア）では true にして配色を反転する
  higherIsBetter?: boolean;
}

const TONE_CLASS: Record<ScoreTone, string> = {
  low: 'bg-success-muted text-risk-low',
  moderate: 'bg-warning-muted text-risk-moderate',
  high: 'bg-danger-muted text-risk-high',
  critical: 'bg-danger-muted text-risk-critical',
};

export function scoreTone(score: number, higherIsBetter = false): ScoreTone {
  const risk = higherIsBetter ? 100 - score : score;
  if (risk < 30) return 'low';
  if (risk < 60) return 'moderate';
  if (risk < 80) return 'high';
  return 'critical';
}

export function ScoreBadge({ label, score, size = 'md', higherIsBetter = false }: ScoreBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${TONE_CLASS[scoreTone(score, higherIsBetter)]} ${sizeClass}`}
    >
      <span className="text-fg-muted">{label}</span>
      <span className="font-bold tabular-nums">{Number.isInteger(score) ? score : score.toFixed(1)}</span>
    </span>
  );
}

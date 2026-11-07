import { getScoreBgColor, getScoreColor, formatScore } from '../../lib/formatters';

interface ScoreBadgeProps {
  label: string;
  score: number;
  size?: 'sm' | 'md';
}

export default function ScoreBadge({ label, score, size = 'md' }: ScoreBadgeProps) {
  const bgColor = getScoreBgColor(score);
  const textColor = getScoreColor(score);
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${bgColor} ${sizeClass}`}>
      <span className="text-gray-600">{label}</span>
      <span className={`font-bold ${textColor}`}>{formatScore(score)}</span>
    </span>
  );
}

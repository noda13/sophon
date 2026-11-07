import { Tooltip } from '../../../ui/Tooltip';
import { scoreLevel } from '../logic/formatters';
import { LEVEL_BADGE } from './tones';

interface StrategyScoreBadgeProps {
  score: number;
  reason: string;
}

export function StrategyScoreBadge({ score, reason }: StrategyScoreBadgeProps) {
  const badge = (
    <span
      className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-bold ${LEVEL_BADGE[scoreLevel(score)]}`}
    >
      {score}
    </span>
  );
  return reason ? <Tooltip content={reason}>{badge}</Tooltip> : badge;
}

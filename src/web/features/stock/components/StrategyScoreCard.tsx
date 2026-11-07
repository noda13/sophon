import { Card } from '../../../ui/Card';
import { scoreBarPercent, scoreLevel } from '../logic/formatters';
import type { LabeledScore } from '../logic/scores';
import { LEVEL_BAR } from './tones';

export function StrategyScoreCard({ item }: { item: LabeledScore }) {
  const { score, reason } = item.score;
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{item.label}</h3>
        <span className="font-mono text-2xl font-bold">{score}</span>
      </div>
      <div
        role="meter"
        aria-label={item.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={scoreBarPercent(score)}
        className="mb-3 h-3 w-full rounded-full bg-surface-overlay"
      >
        <div
          className={`h-3 rounded-full ${LEVEL_BAR[scoreLevel(score)]}`}
          style={{ width: `${scoreBarPercent(score)}%` }}
        />
      </div>
      <p className="text-xs text-fg-muted">{reason}</p>
    </Card>
  );
}

import type { StrategyMeta, StrategyScore } from '../../../../shared/schema/stock';

export interface LabeledScore {
  id: string;
  label: string;
  score: StrategyScore;
}

// strategies.json の並びを優先し、そこに無い戦略 ID は末尾に ID のまま出す
export function labelScores(
  scores: Readonly<Record<string, StrategyScore>>,
  strategies: readonly StrategyMeta[],
): LabeledScore[] {
  const order = new Map(strategies.map((s, i) => [s.id as string, i]));
  const names = new Map(strategies.map((s) => [s.id as string, s.displayName]));
  return Object.entries(scores)
    .map(([id, score]) => ({ id, label: names.get(id) ?? id, score }))
    .sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
}

import { describe, expect, it } from 'vitest';
import type { StrategyMeta, StrategyScore } from '../../../../shared/schema/stock';
import { labelScores } from './scores';

const score = (n: number): StrategyScore => ({ score: n, components: {}, reason: '' });
const strategies: StrategyMeta[] = [
  { id: 'kiyohara', displayName: '清原流', description: '', active: true },
  { id: 'graham', displayName: 'グレアム流', description: '', active: true },
];

describe('labelScores', () => {
  it('strategies.json の順に並べ、表示名を付ける', () => {
    const result = labelScores({ graham: score(2), kiyohara: score(1) }, strategies);
    expect(result.map((r) => [r.id, r.label])).toEqual([
      ['kiyohara', '清原流'],
      ['graham', 'グレアム流'],
    ]);
  });

  it('未知の戦略は ID のまま末尾に置く', () => {
    const result = labelScores({ mystery: score(9), graham: score(2) }, strategies);
    expect(result.map((r) => r.label)).toEqual(['グレアム流', 'mystery']);
  });
});

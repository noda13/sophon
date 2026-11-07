import { describe, expect, it } from 'vitest';
import { getRunWarnings, type RunHealth } from './runHealth';

const healthy: RunHealth = {
  sources: { total: 10, failed: [] },
  summaries: { attempted: 10, failed: 0 },
  assessment: 'ok',
};

describe('getRunWarnings', () => {
  it('returns nothing for an old meta without lastRun', () => {
    expect(getRunWarnings(undefined)).toEqual([]);
  });

  it('returns nothing for a healthy run', () => {
    expect(getRunWarnings(healthy)).toEqual([]);
  });

  it('does not warn when the assessment was skipped', () => {
    expect(getRunWarnings({ ...healthy, assessment: 'skipped' })).toEqual([]);
  });

  it('lists the failed sources with their count', () => {
    expect(getRunWarnings({ ...healthy, sources: { total: 10, failed: ['ft', 'wsj'] } })).toEqual([
      'RSS 2/10 ソースが取得できませんでした: ft、wsj',
    ]);
  });

  it('warns about summaries when half or more of the attempts failed', () => {
    expect(getRunWarnings({ ...healthy, summaries: { attempted: 10, failed: 5 } })).toEqual(['記事の要約に失敗しています']);
    expect(getRunWarnings({ ...healthy, summaries: { attempted: 1, failed: 1 } })).toEqual(['記事の要約に失敗しています']);
  });

  it('does not warn about summaries when fewer than half failed or nothing was attempted', () => {
    expect(getRunWarnings({ ...healthy, summaries: { attempted: 10, failed: 4 } })).toEqual([]);
    expect(getRunWarnings({ ...healthy, summaries: { attempted: 0, failed: 0 } })).toEqual([]);
  });

  it('warns when the assessment failed', () => {
    expect(getRunWarnings({ ...healthy, assessment: 'failed' })).toEqual(['リスク評価の更新に失敗しました']);
  });

  it('combines every warning in order', () => {
    expect(getRunWarnings({
      sources: { total: 10, failed: ['ft'] },
      summaries: { attempted: 4, failed: 4 },
      assessment: 'failed',
    })).toHaveLength(3);
  });
});

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CompositeRisk, RiskAssessment } from '../../../../shared/schema/econ';
import type { UserProfile } from '../logic/profile';
import { PROFILE_PRESETS } from '../logic/profilePresets';
import { usePersonalizedRisk } from './usePersonalizedRisk';

const profile: UserProfile = { age: 40, sensitivity: 'standard', allocation: PROFILE_PRESETS[0]!.allocation };
const composite: CompositeRisk = { compositeScore: 50, level: 'elevated', breakdown: [] };
const risks: RiskAssessment[] = [
  { category: 'technology', score: 75, level: 'high', summaryJa: '', factorsJa: [], assessedAt: '2026-01-01T00:00:00Z' },
  { category: 'social_policy', score: 20, level: 'low', summaryJa: '', factorsJa: [], assessedAt: '2026-01-01T00:00:00Z' },
];

describe('usePersonalizedRisk', () => {
  it('プロフィールがなければ何も算出しない', () => {
    const { result } = renderHook(() => usePersonalizedRisk(null, composite, risks));
    expect(result.current.result).toBeNull();
    expect(result.current.thresholds).toBeNull();
    expect(result.current.impactByCategory.size).toBe(0);
    expect(result.current.relevanceFor('VIX')).toBeNull();
  });

  it('データが揃っていなければ result は null', () => {
    const { result } = renderHook(() => usePersonalizedRisk(profile, undefined, risks));
    expect(result.current.result).toBeNull();
    expect(result.current.impactByCategory.size).toBe(2);
  });

  it('個人化スコアとカテゴリ別の影響と指標の関連度を返す', () => {
    const { result } = renderHook(() => usePersonalizedRisk(profile, composite, risks));
    expect(result.current.result?.personalizedScore).toBeGreaterThan(0);
    expect(result.current.result?.categoryImpacts).toHaveLength(2);
    expect(result.current.impactByCategory.get('technology')?.impactLevel).toBe('high');
    expect(result.current.thresholds?.warning).toBeLessThan(result.current.thresholds?.alert ?? 0);
    expect(result.current.relevanceFor('SPX')).toBe('high');
  });

  it('入力が変わらなければ同じ参照を返す', () => {
    const { result, rerender } = renderHook(() => usePersonalizedRisk(profile, composite, risks));
    const first = result.current.result;
    rerender();
    expect(result.current.result).toBe(first);
  });
});

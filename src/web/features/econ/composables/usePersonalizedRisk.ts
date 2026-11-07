import { useMemo } from 'react';
import type { CompositeRisk, RiskAssessment } from '../../../../shared/schema/econ';
import {
  calculateCategoryImpact,
  getIndicatorRelevance,
  getPersonalizedThresholds,
  personalizeRisk,
} from '../logic/personalizedRisk';
import type { CategoryImpact, PersonalizedResult, UserProfile } from '../logic/profile';

export function usePersonalizedRisk(
  profile: UserProfile | null,
  compositeRisk: CompositeRisk | undefined,
  risks: readonly RiskAssessment[] | undefined,
) {
  const result = useMemo<PersonalizedResult | null>(() => {
    if (!profile || !compositeRisk || !risks) return null;
    return personalizeRisk(compositeRisk, [...risks], profile);
  }, [profile, compositeRisk, risks]);

  const thresholds = useMemo(() => (profile ? getPersonalizedThresholds(profile) : null), [profile]);

  // 総合指数が壊れて result が null でも、カテゴリごとの影響は出せる
  const impactByCategory = useMemo(() => {
    const map = new Map<string, CategoryImpact>();
    if (!profile || !risks) return map;
    for (const risk of risks) {
      map.set(risk.category, calculateCategoryImpact(risk.category, risk.score, profile.allocation));
    }
    return map;
  }, [profile, risks]);

  const relevanceFor = useMemo(
    () => (code: string) => (profile ? getIndicatorRelevance(code, profile.allocation) : null),
    [profile],
  );

  return { result, thresholds, impactByCategory, relevanceFor };
}

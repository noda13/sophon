import { useMemo } from 'react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { personalizeRisk } from '../lib/personalizedRisk';
import type { PersonalizedResult } from '../lib/types/profile';
import type { CompositeRisk, RiskAssessment } from '../services/api';

export function usePersonalizedRisk(
  compositeRisk: CompositeRisk | undefined,
  risks: RiskAssessment[] | undefined,
) {
  const { profile } = useUserProfile();

  const result = useMemo<PersonalizedResult | null>(() => {
    if (!profile || !compositeRisk || !risks) return null;
    return personalizeRisk(compositeRisk, risks, profile);
  }, [profile, compositeRisk, risks]);

  return { result };
}

// Canonical type definitions live here so riskConstants has no upstream deps.
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

export const RISK_CATEGORIES = [
  'currency_finance',
  'geopolitics_supply_chain',
  'technology',
  'social_policy',
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_WEIGHTS: Record<RiskCategory, number> = {
  currency_finance: 0.3,
  geopolitics_supply_chain: 0.3,
  technology: 0.2,
  social_policy: 0.2,
};

export function scoreToLevel(score: number): RiskLevel {
  if (score <= 20) return 'low';
  if (score <= 40) return 'moderate';
  if (score <= 60) return 'elevated';
  if (score <= 80) return 'high';
  return 'critical';
}

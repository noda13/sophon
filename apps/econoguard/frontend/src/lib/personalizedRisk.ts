import type {
  AssetAllocation,
  MonitoringSensitivity,
  UserProfile,
  ActionSignal,
  CategoryImpact,
  PersonalizedResult,
} from './types/profile';
import { getSignalFromScore } from './actionSignals';
import { CHART_ALERT_SCORE, CHART_WARNING_SCORE } from './riskThresholds';
import { RISK_CATEGORIES } from './riskColors';
import type { RiskAssessment, CompositeRisk } from '../services/api';

// ---------------------------------------------------------------------------
// 1. Utility
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// 2. Individual sensitivity calculators
// ---------------------------------------------------------------------------

/**
 * Age-based sensitivity multiplier.
 * Older investors carry more sensitivity to drawdowns.
 * 48 years old → 1.195
 */
export function calculateAgeSensitivity(age: number): number {
  return clamp(1 + (age - 35) * 0.015, 0.85, 1.35);
}

/**
 * Equity-weight sensitivity multiplier.
 * Higher equity exposure amplifies risk scores.
 * 90% equity → 1.06
 */
export function calculateEquitySensitivity(allocation: AssetAllocation): number {
  const totalEquity =
    allocation.domestic_equity +
    allocation.developed_equity +
    allocation.emerging_equity;
  return clamp(0.7 + totalEquity * 0.004, 0.7, 1.3);
}

/**
 * Total foreign / overseas exposure (%).
 * Includes all non-domestic equity, bonds, and REITs.
 */
export function calculateForeignExposure(allocation: AssetAllocation): number {
  return (
    allocation.developed_equity +
    allocation.emerging_equity +
    allocation.developed_bond +
    allocation.emerging_bond +
    allocation.developed_reit
  );
}

/**
 * Monitoring-sensitivity preference multiplier.
 */
export function getSensitivityMultiplier(sensitivity: MonitoringSensitivity): number {
  const map: Record<MonitoringSensitivity, number> = {
    sensitive: 1.15,
    standard: 1.0,
    relaxed: 0.85,
  };
  return map[sensitivity];
}

// ---------------------------------------------------------------------------
// 3. Composite personalized score
// ---------------------------------------------------------------------------

/**
 * Combines the age, equity-weight, and monitoring-sensitivity multipliers by
 * summing their deviations from 1.0, then caps the result to 0.7–1.4.
 *
 * Multiplying them directly reaches ≈2.0 for an older, equity-heavy, sensitive
 * profile, which pushed a mid-range generic composite (≈43) into 「即時対応」.
 */
export function getCombinedMultiplier(profile: UserProfile): number {
  const age = calculateAgeSensitivity(profile.age);
  const equity = calculateEquitySensitivity(profile.allocation);
  const sensitivity = getSensitivityMultiplier(profile.sensitivity);

  return clamp(1 + (age - 1) + (equity - 1) + (sensitivity - 1), 0.7, 1.4);
}

/**
 * Scale a generic risk score by the profile's combined multiplier.
 * Returns a clamped integer 0–100.
 */
export function calculatePersonalizedScore(
  genericScore: number,
  profile: UserProfile,
): number {
  const raw = genericScore * getCombinedMultiplier(profile);
  return Math.round(clamp(raw, 0, 100));
}

// ---------------------------------------------------------------------------
// 4. Category → asset-class impact mapping
// ---------------------------------------------------------------------------

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

const CATEGORY_IMPACT_MAP: Record<
  RiskCategory,
  { high: (keyof AssetAllocation)[]; medium: (keyof AssetAllocation)[]; low: (keyof AssetAllocation)[] }
> = {
  currency_finance: {
    high: ['developed_equity', 'developed_bond', 'developed_reit', 'emerging_equity', 'emerging_bond'],
    medium: ['domestic_equity', 'domestic_reit'],
    low: ['domestic_bond', 'cash'],
  },
  geopolitics_supply_chain: {
    high: ['emerging_equity', 'emerging_bond'],
    medium: ['developed_equity', 'developed_bond', 'domestic_equity'],
    low: ['domestic_bond', 'cash', 'domestic_reit'],
  },
  technology: {
    high: ['developed_equity'],
    medium: ['emerging_equity', 'domestic_equity'],
    low: ['domestic_bond', 'developed_bond', 'cash'],
  },
  social_policy: {
    high: ['domestic_bond', 'domestic_equity', 'domestic_reit'],
    medium: ['developed_bond'],
    low: ['developed_equity', 'cash'],
  },
};

// ---------------------------------------------------------------------------
// 5. Per-category impact calculation
// ---------------------------------------------------------------------------

const CATEGORY_RISK_TEXT: Record<RiskCategory, string> = {
  currency_finance: '円高進行時に為替差損が生じるリスクがあります',
  geopolitics_supply_chain: '地政学的な緊張により供給網が混乱するリスクがあります',
  technology: '規制強化や半導体関連のリスクがあります',
  social_policy: '政策変更や金利動向の影響を受けるリスクがあります',
};

/**
 * Given a risk category and the user's allocation, returns how strongly that
 * category affects the portfolio.
 *
 * affectedPct is a blended figure across asset classes (high-impact classes
 * × 1.0 + medium-impact classes × 0.5), not the share of any single class.
 * Low-impact classes are excluded so the number does not inflate perceived
 * exposure.
 *
 * impactLevel combines affectedPct with the category's own risk score so a
 * high-score category is more likely to surface as "high" and a low-score
 * category can be downgraded even when exposure is moderate.
 *   - affectedPct thresholds: ≥40 → high base, ≥15 → medium base, else low base
 *   - score factor: score ≥ 70 upgrades one level; score < 30 downgrades one level
 */
export function calculateCategoryImpact(
  category: string,
  score: number,
  allocation: AssetAllocation,
): CategoryImpact {
  const mapping = Object.prototype.hasOwnProperty.call(CATEGORY_IMPACT_MAP, category)
    ? CATEGORY_IMPACT_MAP[category as RiskCategory]
    : undefined;

  if (!mapping) {
    if (import.meta.env.DEV) {
      console.warn(`[calculateCategoryImpact] Unknown risk category: "${category}". Add it to CATEGORY_IMPACT_MAP.`);
    }
    return {
      category,
      impactLevel: 'low',
      affectedPct: 0,
      description: '現在のポートフォリオへの影響は限定的です。',
    };
  }

  const highSum = mapping.high.reduce((sum, key) => sum + allocation[key], 0);
  const mediumSum = mapping.medium.reduce((sum, key) => sum + allocation[key], 0);
  const affectedPct = Math.round(highSum + mediumSum * 0.5);

  let baseLevel: 0 | 1 | 2 = affectedPct >= 40 ? 2 : affectedPct >= 15 ? 1 : 0;

  if (score >= 70 && baseLevel < 2) baseLevel = (baseLevel + 1) as 0 | 1 | 2;
  if (score < 30 && baseLevel > 0) baseLevel = (baseLevel - 1) as 0 | 1 | 2;

  const levelLabels: ['low', 'medium', 'high'] = ['low', 'medium', 'high'];
  const impactLevel: 'high' | 'medium' | 'low' = levelLabels[baseLevel];

  const lowSuffix = impactLevel === 'low' ? '現在のポートフォリオへの影響は限定的です。' : '';
  const description = `${CATEGORY_RISK_TEXT[category as RiskCategory]}（影響を受ける割合: 約${affectedPct}%）。${lowSuffix}`;

  return { category, impactLevel, affectedPct, description };
}

// ---------------------------------------------------------------------------
// 6. Main entry point
// ---------------------------------------------------------------------------

/**
 * Personalize composite + category risk data with the user's profile.
 * Returns null when the composite score is not a finite number.
 */
export function personalizeRisk(
  compositeRisk: CompositeRisk,
  risks: RiskAssessment[],
  profile: UserProfile,
): PersonalizedResult | null {
  if (!Number.isFinite(compositeRisk.compositeScore)) return null;

  const personalizedScore = calculatePersonalizedScore(
    compositeRisk.compositeScore,
    profile,
  );

  const signal: ActionSignal | null = getSignalFromScore(personalizedScore);
  if (signal === null) return null;

  const categoryImpacts: CategoryImpact[] = risks.map((risk) =>
    calculateCategoryImpact(risk.category, risk.score, profile.allocation),
  );

  const totalEquity =
    profile.allocation.domestic_equity +
    profile.allocation.developed_equity +
    profile.allocation.emerging_equity;
  const equityPct = Math.round(totalEquity);

  const signalDescriptionMap: Record<ActionSignal, string> = {
    hold: '現状維持で問題ない水準です',
    watch: '市場動向を注視すべき水準です',
    prepare: 'リバランスの準備を検討すべき水準です',
    hedge: 'ヘッジを検討すべき水準です',
    act: '即座にリスク対応を検討すべき水準です',
  };

  const interpretation = `${profile.age}歳・株式${equityPct}%のポートフォリオでは、${signalDescriptionMap[signal]}`;

  return { personalizedScore, signal, categoryImpacts, interpretation };
}

// ---------------------------------------------------------------------------
// 7. Threshold helpers for chart reference lines
// ---------------------------------------------------------------------------

/**
 * Returns warning / alert thresholds in the *generic* score scale so that
 * reference lines on the trend chart align correctly with the raw API values.
 *
 * Divides the personalized thresholds (CHART_WARNING_SCORE / CHART_ALERT_SCORE) by the same multiplier used by
 * calculatePersonalizedScore to map them back to generic score space.
 */
export function getPersonalizedThresholds(
  profile: UserProfile,
): { warning: number; alert: number } {
  const combinedMultiplier = getCombinedMultiplier(profile);

  return {
    warning: clamp(Math.round(CHART_WARNING_SCORE / combinedMultiplier), 10, 90),
    alert: clamp(Math.round(CHART_ALERT_SCORE / combinedMultiplier), 10, 90),
  };
}

// ---------------------------------------------------------------------------
// 8. Indicator relevance
// ---------------------------------------------------------------------------

/**
 * Returns how relevant a market indicator is for a given portfolio allocation.
 */
export function getIndicatorRelevance(
  indicatorCode: string,
  allocation: AssetAllocation,
): 'high' | 'medium' | 'low' {
  const foreignExposure = calculateForeignExposure(allocation);
  const totalEquity =
    allocation.domestic_equity +
    allocation.developed_equity +
    allocation.emerging_equity;

  switch (indicatorCode) {
    case 'USDJPY':
      if (foreignExposure > 50) return 'high';
      if (foreignExposure > 20) return 'medium';
      return 'low';

    case 'DJIA':
    case 'SPX':
      if (allocation.developed_equity > 30 || totalEquity > 60) return 'high';
      if (totalEquity > 30) return 'medium';
      return 'low';

    case 'TOPIX':
      if (allocation.domestic_equity > 30) return 'high';
      if (allocation.domestic_equity > 10) return 'medium';
      return 'low';

    case 'VIX':
      if (totalEquity > 60) return 'high';
      if (totalEquity > 30) return 'medium';
      return 'low';

    case 'UST10Y':
      if (allocation.developed_bond > 20) return 'high';
      if (totalEquity > 50) return 'medium';
      return 'low';

    case 'UST3M':
      // Short-term rates affect cash-heavy portfolios and variable rate exposure
      if (allocation.cash > 20 || allocation.domestic_bond > 20) return 'high';
      if (allocation.developed_bond > 10) return 'medium';
      return 'low';

    case 'WTI':
      // Oil affects emerging market economies and inflation broadly
      if (allocation.emerging_equity > 15 || allocation.emerging_bond > 10) return 'high';
      if (foreignExposure > 40) return 'medium';
      return 'low';

    case 'GOLD':
      // Gold is a safe haven — relevant when equity exposure is high
      if (totalEquity > 70) return 'high';
      if (totalEquity > 40) return 'medium';
      return 'low';

    case 'HYG':
      // High-yield bond ETF — relevant for credit risk, especially with high equity or EM exposure
      if (allocation.developed_equity > 30 || allocation.emerging_equity > 10) return 'high';
      if (totalEquity > 30) return 'medium';
      return 'low';

    default:
      return 'low';
  }
}

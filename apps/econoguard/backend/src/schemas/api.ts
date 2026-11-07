import { z } from 'zod';
import { scoreToLevel, RISK_WEIGHTS, RISK_CATEGORIES } from './riskConstants.js';
import type { RiskLevel, RiskCategory } from './riskConstants.js';

export const riskCategorySchema = z.enum(RISK_CATEGORIES);

// Re-export the canonical types so consumers can import from a single place.
export type { RiskCategory, RiskLevel };

export { scoreToLevel, RISK_WEIGHTS };

export interface AssetAllocation {
  domestic_equity: number;      // 国内株式 (%)
  developed_equity: number;     // 先進国株式 (%)
  emerging_equity: number;      // 新興国株式 (%)
  domestic_bond: number;        // 国内債券 (%)
  developed_bond: number;       // 先進国債券 (%)
  emerging_bond: number;        // 新興国債券 (%)
  domestic_reit: number;        // 国内REIT (%)
  developed_reit: number;       // 先進国REIT (%)
  cash: number;                 // 現金 (%)
}

export type MonitoringSensitivity = 'sensitive' | 'standard' | 'relaxed';

export interface UserProfile {
  age: number;
  sensitivity: MonitoringSensitivity;
  allocation: AssetAllocation;
}

export type ActionSignal = 'hold' | 'watch' | 'prepare' | 'hedge' | 'act';

export interface CategoryImpact {
  category: string;
  impactLevel: 'high' | 'medium' | 'low';
  affectedPct: number;          // blended exposure % (high-impact classes × 1.0 + medium × 0.5)
  description: string;          // Japanese description
}

export interface PersonalizedResult {
  personalizedScore: number;
  signal: ActionSignal;
  categoryImpacts: CategoryImpact[];
  interpretation: string;       // Japanese one-liner
}

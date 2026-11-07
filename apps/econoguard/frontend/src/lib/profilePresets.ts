import type { AssetAllocation, UserProfile } from './types/profile';

export interface ProfilePreset {
  id: string;
  label: string;
  allocation: AssetAllocation;
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: 'all_country',
    label: 'オルカン型',
    allocation: {
      domestic_equity: 5,
      developed_equity: 75,
      emerging_equity: 10,
      domestic_bond: 0,
      developed_bond: 0,
      emerging_bond: 0,
      domestic_reit: 0,
      developed_reit: 0,
      cash: 10,
    },
  },
  {
    id: 'sp500',
    label: 'S&P500集中',
    allocation: {
      domestic_equity: 0,
      developed_equity: 90,
      emerging_equity: 0,
      domestic_bond: 0,
      developed_bond: 0,
      emerging_bond: 0,
      domestic_reit: 0,
      developed_reit: 0,
      cash: 10,
    },
  },
  {
    id: 'balanced',
    label: 'バランス型',
    allocation: {
      domestic_equity: 15,
      developed_equity: 25,
      emerging_equity: 10,
      domestic_bond: 15,
      developed_bond: 10,
      emerging_bond: 5,
      domestic_reit: 5,
      developed_reit: 5,
      cash: 10,
    },
  },
  {
    id: 'eight_equal',
    label: '8資産均等',
    allocation: {
      domestic_equity: 12,
      developed_equity: 13,
      emerging_equity: 12,
      domestic_bond: 13,
      developed_bond: 12,
      emerging_bond: 13,
      domestic_reit: 12,
      developed_reit: 13,
      cash: 0,
    },
  },
  {
    id: 'bond_heavy',
    label: '債券重視',
    allocation: {
      domestic_equity: 5,
      developed_equity: 10,
      emerging_equity: 5,
      domestic_bond: 30,
      developed_bond: 20,
      emerging_bond: 5,
      domestic_reit: 0,
      developed_reit: 0,
      cash: 25,
    },
  },
];

const defaultPreset =
  PROFILE_PRESETS.find((p) => p.id === 'all_country') ?? PROFILE_PRESETS[0];

export const DEFAULT_PROFILE: UserProfile = {
  age: 40,
  sensitivity: 'standard',
  allocation: defaultPreset.allocation,
};

export const ASSET_CLASS_LABELS: Record<keyof AssetAllocation, string> = {
  domestic_equity: '国内株式',
  developed_equity: '先進国株式',
  emerging_equity: '新興国株式',
  domestic_bond: '国内債券',
  developed_bond: '先進国債券',
  emerging_bond: '新興国債券',
  domestic_reit: '国内REIT',
  developed_reit: '先進国REIT',
  cash: '現金',
};

export const ASSET_CLASS_COLORS: Record<keyof AssetAllocation, string> = {
  domestic_equity: '#ef4444',
  developed_equity: '#f97316',
  emerging_equity: '#eab308',
  domestic_bond: '#22c55e',
  developed_bond: '#14b8a6',
  emerging_bond: '#06b6d4',
  domestic_reit: '#8b5cf6',
  developed_reit: '#a855f7',
  cash: '#6b7280',
};

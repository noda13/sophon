export const riskLevelConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  low: { label: '低', color: 'text-green-400', bgColor: 'bg-green-900/30', borderColor: 'border-green-500' },
  moderate: { label: '中程度', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30', borderColor: 'border-yellow-500' },
  elevated: { label: 'やや高い', color: 'text-orange-400', bgColor: 'bg-orange-900/30', borderColor: 'border-orange-500' },
  high: { label: '高い', color: 'text-red-400', bgColor: 'bg-red-900/30', borderColor: 'border-red-500' },
  critical: { label: '危機的', color: 'text-red-300', bgColor: 'bg-red-950/50', borderColor: 'border-red-400' },
};

export const RISK_CATEGORIES = [
  'currency_finance',
  'geopolitics_supply_chain',
  'technology',
  'social_policy',
] as const;

export const categoryLabels: Record<string, string> = {
  currency_finance: '通貨・金融',
  geopolitics_supply_chain: '地政学・供給網',
  technology: 'テクノロジー',
  social_policy: '社会・政策',
};

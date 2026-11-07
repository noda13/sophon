export { RISK_CATEGORIES } from '../../../../shared/schema/econ';

export interface LevelStyle {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  // recharts の SVG 属性に渡すための CSS 変数
  cssVar: string;
}

// styles.css のリスクトークンは4段階なので、elevated は high のオレンジ、high は danger の赤に寄せて5段階を分ける。
export const riskLevelConfig: Record<string, LevelStyle> = {
  low: { label: '低', color: 'text-risk-low', bgColor: 'bg-success-muted', borderColor: 'border-risk-low', cssVar: 'var(--color-risk-low)' },
  moderate: { label: '中程度', color: 'text-risk-moderate', bgColor: 'bg-warning-muted', borderColor: 'border-risk-moderate', cssVar: 'var(--color-risk-moderate)' },
  elevated: { label: 'やや高い', color: 'text-risk-high', bgColor: 'bg-warning-muted', borderColor: 'border-risk-high', cssVar: 'var(--color-risk-high)' },
  high: { label: '高い', color: 'text-danger', bgColor: 'bg-danger-muted', borderColor: 'border-danger', cssVar: 'var(--color-danger)' },
  critical: { label: '危機的', color: 'text-risk-critical', bgColor: 'bg-danger-muted', borderColor: 'border-risk-critical', cssVar: 'var(--color-risk-critical)' },
};

export const categoryLabels: Record<string, string> = {
  currency_finance: '通貨・金融',
  geopolitics_supply_chain: '地政学・供給網',
  technology: 'テクノロジー',
  social_policy: '社会・政策',
};

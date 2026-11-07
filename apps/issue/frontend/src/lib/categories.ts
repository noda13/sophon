export const ISSUE_CATEGORIES = [
  'employment_economy',
  'healthcare_welfare',
  'education',
  'childcare_family',
  'aging_care',
  'governance',
  'environment_disaster',
  'community_regional',
] as const;

export type IssueCategoryType = typeof ISSUE_CATEGORIES[number];

export const CATEGORY_LABELS: Record<IssueCategoryType, string> = {
  employment_economy: '雇用・経済',
  healthcare_welfare: '医療・福祉',
  education: '教育・学習',
  childcare_family: '子育て・家族',
  aging_care: '高齢化・介護',
  governance: '行政・制度',
  environment_disaster: '環境・防災',
  community_regional: '地方・コミュニティ',
};

export const CATEGORY_COLORS: Record<IssueCategoryType, string> = {
  employment_economy: 'bg-blue-100 text-blue-800',
  healthcare_welfare: 'bg-green-100 text-green-800',
  education: 'bg-yellow-100 text-yellow-800',
  childcare_family: 'bg-pink-100 text-pink-800',
  aging_care: 'bg-purple-100 text-purple-800',
  governance: 'bg-gray-100 text-gray-800',
  environment_disaster: 'bg-emerald-100 text-emerald-800',
  community_regional: 'bg-orange-100 text-orange-800',
};

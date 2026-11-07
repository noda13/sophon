import { TECH_CATEGORIES, TECH_CATEGORY_META, type TechCategory } from '../../../../shared/schema/tech';

export const ALL_CATEGORIES = 'all';
export type CategoryFilter = TechCategory | typeof ALL_CATEGORIES;

export interface CategoryTabItem {
  value: CategoryFilter;
  label: string;
  title?: string;
}

export const CATEGORY_TAB_ITEMS: readonly CategoryTabItem[] = [
  { value: ALL_CATEGORIES, label: 'すべて' },
  ...TECH_CATEGORIES.map((c) => ({ value: c, label: TECH_CATEGORY_META[c].label, title: TECH_CATEGORY_META[c].description })),
];

export function isCategoryFilter(value: string): value is CategoryFilter {
  return value === ALL_CATEGORIES || (TECH_CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(category: TechCategory): string {
  return TECH_CATEGORY_META[category].label;
}

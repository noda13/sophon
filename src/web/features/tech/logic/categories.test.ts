import { describe, expect, it } from 'vitest';
import { ALL_CATEGORIES, CATEGORY_TAB_ITEMS, categoryLabel, isCategoryFilter } from './categories';

describe('categories', () => {
  it('先頭に「すべて」、続けて4カテゴリを並べる', () => {
    expect(CATEGORY_TAB_ITEMS.map((i) => i.value)).toEqual([ALL_CATEGORIES, 'trend', 'ai', 'security', 'release']);
    expect(CATEGORY_TAB_ITEMS[0]!.label).toBe('すべて');
  });

  it('isCategoryFilter は既知の値だけを通す', () => {
    expect(isCategoryFilter('ai')).toBe(true);
    expect(isCategoryFilter('all')).toBe(true);
    expect(isCategoryFilter('nope')).toBe(false);
  });

  it('categoryLabel は日本語の表示名を返す', () => {
    expect(categoryLabel('security')).toBe('セキュリティ');
  });
});

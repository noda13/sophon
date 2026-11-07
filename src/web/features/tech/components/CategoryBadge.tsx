import type { TechCategory } from '../../../../shared/schema/tech';
import { categoryLabel } from '../logic/categories';

export const CATEGORY_TONE: Record<TechCategory, string> = {
  trend: 'border-info/40 bg-info-muted text-info',
  ai: 'border-accent/40 bg-accent-muted text-accent',
  security: 'border-danger/40 bg-danger-muted text-danger',
  release: 'border-success/40 bg-success-muted text-success',
};

export function CategoryBadge({ category }: { category: TechCategory }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium ${CATEGORY_TONE[category]}`}>
      {categoryLabel(category)}
    </span>
  );
}

import { Disclaimer } from '../../../ui/Disclaimer';
import type { CategoryImpact, PersonalizedResult } from '../logic/profile';
import { categoryLabels } from '../logic/riskColors';

const IMPACT_STYLE: Record<CategoryImpact['impactLevel'], { label: string; color: string; bgColor: string; borderColor: string }> = {
  high: { label: '高', color: 'text-danger', bgColor: 'bg-danger-muted', borderColor: 'border-danger' },
  medium: { label: '中', color: 'text-warning', bgColor: 'bg-warning-muted', borderColor: 'border-warning' },
  low: { label: '低', color: 'text-success', bgColor: 'bg-success-muted', borderColor: 'border-success' },
};

export function PortfolioImpactPanel({ personalized }: { personalized: PersonalizedResult | null }) {
  if (!personalized) return null;

  return (
    <section aria-label="ポートフォリオへの影響">
      <h2 className="mb-3 text-lg font-semibold text-fg">ポートフォリオへの影響</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {personalized.categoryImpacts.map((impact) => {
          const style = IMPACT_STYLE[impact.impactLevel];
          return (
            <div key={impact.category} className={`rounded-lg border ${style.borderColor} ${style.bgColor} p-4`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-fg">{categoryLabels[impact.category] ?? impact.category}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${style.color}`}>影響: {style.label}</span>
              </div>
              <p className="text-sm text-fg-muted">{impact.description}</p>
            </div>
          );
        })}
      </div>
      <Disclaimer className="mt-3" />
    </section>
  );
}

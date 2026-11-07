import { useQuery } from '@tanstack/react-query';
import { fetchCompositeRisk, fetchRisks } from '../../services/api';
import { usePersonalizedRisk } from '../../hooks/usePersonalizedRisk';
import { categoryLabels } from '../../lib/riskColors';
import { INVESTMENT_DISCLAIMER } from '../../lib/disclaimer';

export function PortfolioImpactPanel() {
  const { data: compositeRisk } = useQuery({
    queryKey: ['compositeRisk'],
    queryFn: fetchCompositeRisk,
  });
  const { data: risks } = useQuery({
    queryKey: ['risks'],
    queryFn: fetchRisks,
  });

  const { result: personalized } = usePersonalizedRisk(compositeRisk, risks);

  if (!personalized) return null;

  const impactLevelConfig = {
    high: { label: '高', color: 'text-red-400', bgColor: 'bg-red-900/30', borderColor: 'border-red-500' },
    medium: { label: '中', color: 'text-yellow-400', bgColor: 'bg-yellow-900/30', borderColor: 'border-yellow-500' },
    low: { label: '低', color: 'text-green-400', bgColor: 'bg-green-900/30', borderColor: 'border-green-500' },
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">ポートフォリオへの影響</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {personalized.categoryImpacts.map((impact) => {
          const config = impactLevelConfig[impact.impactLevel];
          const catLabel = categoryLabels[impact.category] || impact.category;
          return (
            <div
              key={impact.category}
              className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">{catLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} font-bold`}>
                  影響: {config.label}
                </span>
              </div>
              <p className="text-sm text-gray-400">{impact.description}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">{INVESTMENT_DISCLAIMER}</p>
    </div>
  );
}

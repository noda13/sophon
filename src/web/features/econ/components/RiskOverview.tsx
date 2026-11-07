import { EmptyState } from '../../../ui/EmptyState';
import { ErrorBox } from '../../../ui/ErrorBox';
import type { NewsArticle, RiskAssessment } from '../../../../shared/schema/econ';
import { sourceNewsFor } from '../logic/dashboard';
import type { CategoryImpact } from '../logic/profile';
import { RiskGauge } from './RiskGauge';

interface Props {
  risks: readonly RiskAssessment[];
  news: readonly NewsArticle[];
  impactByCategory: ReadonlyMap<string, CategoryImpact>;
  isError?: boolean;
}

export function RiskOverview({ risks, news, impactByCategory, isError = false }: Props) {
  return (
    <section aria-label="リスク評価">
      <h2 className="mb-3 text-lg font-semibold text-fg">リスク評価</h2>
      {isError ? (
        <ErrorBox message="リスク評価データの取得に失敗しました。" />
      ) : risks.length === 0 ? (
        <EmptyState title="リスク評価データがありません" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {risks.map((risk) => (
            <RiskGauge
              key={risk.category}
              risk={risk}
              sourceNews={sourceNewsFor(risk, news)}
              impact={impactByCategory.get(risk.category)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

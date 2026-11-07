import { riskLevelConfig, categoryLabels } from '../../lib/riskColors';
import { safeHttpUrl } from '../../lib/formatters';
import { useNews } from '../../hooks/useNews';
import type { RiskAssessment, NewsArticle } from '../../services/api';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { calculateCategoryImpact } from '../../lib/personalizedRisk';

interface Props {
  risk: RiskAssessment;
}

export function RiskGauge({ risk }: Props) {
  const config = riskLevelConfig[risk.level] || riskLevelConfig.moderate;
  const label = categoryLabels[risk.category] || risk.category;
  const { profile } = useUserProfile();
  const impact = profile
    ? calculateCategoryImpact(risk.category, risk.score, profile.allocation)
    : null;

  const { data: allNews } = useNews();

  const sourceNews: NewsArticle[] = (risk.sourceNewsIds ?? [])
    .map(id => allNews?.find(a => a.id === id))
    .filter((a): a is NewsArticle => a !== undefined);

  const delta = risk.delta;
  const deltaEl = delta !== undefined ? (
    <span className={`text-xs font-mono ml-2 ${
      delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-gray-500'
    }`}>
      {delta > 0 ? `↑+${delta}` : delta < 0 ? `↓${delta}` : '→0'}
    </span>
  ) : null;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">{label}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} font-bold`}>
          {config.label}
        </span>
      </div>
      <div className={`text-3xl font-bold ${config.color} mb-2 flex items-baseline`}>
        {risk.score}
        <span className="text-sm text-gray-500 ml-1">/100</span>
        {deltaEl}
      </div>
      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{risk.summaryJa}</p>
      {risk.changeReasonJa && (
        <p className="text-xs text-gray-500 italic mb-2">{risk.changeReasonJa}</p>
      )}
      <div className="space-y-1 mb-2">
        {risk.factorsJa.slice(0, 3).map((factor, i) => (
          <div key={`${i}-${factor}`} className="text-xs text-gray-500 flex items-start gap-1">
            <span className="mt-0.5">•</span>
            <span>{factor}</span>
          </div>
        ))}
      </div>
      {sourceNews.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/30">
          <p className="text-xs text-gray-600 mb-1">根拠ニュース</p>
          <div className="space-y-1">
            {sourceNews.map(article => {
              const href = safeHttpUrl(article.originalUrl);
              const title = `${article.originalTitle.slice(0, 60)}${article.originalTitle.length > 60 ? '…' : ''}`;
              const className = 'block text-xs text-blue-500 hover:text-blue-400 truncate';
              return href ? (
                <a
                  key={article.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  title={article.originalTitle}
                >
                  {title}
                </a>
              ) : (
                <span key={article.id} className={className} title={article.originalTitle}>
                  {title}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {impact && (
        <div className="mt-3 pt-2 border-t border-gray-700/50">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            impact.impactLevel === 'high' ? 'bg-red-900/30 text-red-400' :
            impact.impactLevel === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
            'bg-green-900/30 text-green-400'
          }`}>
            あなたへの影響: {impact.impactLevel === 'high' ? '高' : impact.impactLevel === 'medium' ? '中' : '低'}
          </span>
        </div>
      )}
    </div>
  );
}

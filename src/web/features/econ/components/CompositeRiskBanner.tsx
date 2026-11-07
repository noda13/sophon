import { Disclaimer } from '../../../ui/Disclaimer';
import { ACTION_SIGNAL_CONFIG } from '../logic/actionSignals';
import type { CompositeRisk } from '../../../../shared/schema/econ';
import type { PersonalizedResult } from '../logic/profile';
import { categoryLabels, riskLevelConfig } from '../logic/riskColors';
import { DeltaBadge } from './DeltaBadge';

interface Props {
  composite: CompositeRisk;
  personalized: PersonalizedResult | null;
  hasProfile: boolean;
}

export function CompositeRiskBanner({ composite, personalized, hasProfile }: Props) {
  const config = riskLevelConfig[composite.level] ?? riskLevelConfig.moderate!;
  const signal = personalized ? ACTION_SIGNAL_CONFIG[personalized.signal] : null;

  return (
    <section
      aria-label="総合リスク指数"
      className={`rounded-lg border-2 ${config.borderColor} ${config.bgColor} p-5`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="mb-1 text-sm font-medium text-fg-muted">総合リスク指数</h2>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={`text-5xl font-bold ${config.color}`}>
              {Number.isFinite(composite.compositeScore) ? composite.compositeScore : '--'}
            </span>
            <span className="text-lg text-fg-subtle">/100</span>
            <span className={`rounded-full border px-3 py-1 text-sm font-bold ${config.borderColor} ${config.color}`}>
              {config.label}
            </span>
            <DeltaBadge delta={composite.delta} className="text-sm" />
          </div>
        </div>
        <ul className="hidden gap-4 md:flex">
          {composite.breakdown.map((item) => (
            <li key={item.category} className="text-center">
              <div className="mb-1 text-xs text-fg-subtle">{categoryLabels[item.category] ?? item.category}</div>
              <div className="font-mono text-sm text-fg">{item.score}</div>
              <div className="text-xs text-fg-subtle">x{item.weight}</div>
            </li>
          ))}
        </ul>
      </div>
      {personalized && signal && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-fg-muted">あなたのリスク:</span>
              <span className={`text-2xl font-bold ${signal.color}`}>{personalized.personalizedScore}</span>
              <span className="text-sm text-fg-subtle">/100</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-bold ${signal.borderColor} ${signal.bgColor} ${signal.color}`}
              >
                {signal.label}
              </span>
            </div>
            <p className="text-sm text-fg-muted">{personalized.interpretation}</p>
          </div>
          <Disclaimer className="mt-2" />
        </div>
      )}
      {!hasProfile && (
        <p className="mt-3 text-xs text-fg-subtle">
          プロフィールを設定すると、パーソナライズされたリスク評価が表示されます
        </p>
      )}
    </section>
  );
}

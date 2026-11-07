import type { StrategyId, StrategyMeta } from '../../../../shared/schema/stock';
import { Tabs } from '../../../ui/Tabs';
import { t } from '../logic/i18n';

interface StrategySelectorProps {
  strategies: readonly StrategyMeta[];
  value: StrategyId;
  onChange: (id: StrategyId) => void;
}

export function StrategySelector({ strategies, value, onChange }: StrategySelectorProps) {
  if (strategies.length === 0) return null;

  const items = strategies.map((s) => ({ value: s.id, label: s.displayName, title: s.description }));
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span className="text-sm text-fg-muted">{t('strategyLabel')}</span>
      <Tabs
        items={items}
        value={value}
        ariaLabel={t('strategyLabel')}
        onChange={(next) => {
          const found = strategies.find((s) => s.id === next);
          if (found) onChange(found.id);
        }}
      />
    </div>
  );
}

import type { StockDetail } from '../../../../shared/schema/stock';
import { Card } from '../../../ui/Card';
import {
  formatDate,
  formatPer,
  formatRatio,
  formatYen,
  netCashRatioTone,
  netCashTone,
} from '../logic/formatters';
import { t } from '../logic/i18n';
import { TONE_TEXT } from './tones';

type Profile = StockDetail['profile'];

interface StockProfileCardProps {
  profile: Profile;
  snapshot: Profile['snapshots'][number] | undefined;
}

function Metric({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md bg-surface-overlay p-3">
      <dt className="mb-1 text-xs text-fg-muted">{label}</dt>
      <dd className={`font-mono ${className}`}>{value}</dd>
    </div>
  );
}

export function StockProfileCard({ profile, snapshot }: StockProfileCardProps) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-accent">{profile.code}</span>
            {profile.marketSegment && (
              <span className="rounded bg-surface-overlay px-2 py-0.5 text-xs text-fg-muted">
                {profile.marketSegment}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-bold">{profile.name}</h1>
          {profile.sector33Name && <p className="mt-0.5 text-sm text-fg-muted">{profile.sector33Name}</p>}
        </div>
        <p className="text-sm text-fg-subtle">
          {t('updatedAt')}: {formatDate(profile.updatedAt)}
        </p>
      </div>

      {snapshot && (
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label={t('metricMarketCap')} value={formatYen(snapshot.marketCap)} />
          <Metric
            label={t('metricNetCash')}
            value={formatYen(snapshot.netCash)}
            className={TONE_TEXT[netCashTone(snapshot.netCash)]}
          />
          <Metric
            label={t('metricNcr')}
            value={formatRatio(snapshot.netCashRatio)}
            className={`font-bold ${TONE_TEXT[netCashRatioTone(snapshot.netCashRatio)]}`}
          />
          <Metric label={t('metricCnper')} value={formatPer(snapshot.cashNeutralPer)} />
        </dl>
      )}
    </Card>
  );
}

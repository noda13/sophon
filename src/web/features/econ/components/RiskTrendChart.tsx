import { Legend, Line, LineChart, ReferenceLine, ResponsiveContainer } from 'recharts';
import { ChartGrid, ChartTooltip, ChartXAxis, ChartYAxis, chartColors, chartMargin } from '../../../ui/chart';
import { EmptyState } from '../../../ui/EmptyState';
import type { RiskCategory } from '../../../../shared/schema/econ';
import type { TrendPoint } from '../logic/dashboard';
import { RISK_CATEGORIES, categoryLabels } from '../logic/riskColors';
import { CHART_ALERT_SCORE, CHART_WARNING_SCORE } from '../logic/riskThresholds';

// 4本が暗い背景で区別でき、リスク段階の色（緑〜赤）と混同しない色相にする
const CATEGORY_COLORS: Record<RiskCategory, string> = {
  currency_finance: '#f87171',
  geopolitics_supply_chain: '#fb923c',
  technology: '#60a5fa',
  social_policy: '#a78bfa',
};

const PERSONAL_ALERT_COLOR = '#f472b6';
const PERSONAL_WARNING_COLOR = '#c084fc';

interface Props {
  trend: readonly TrendPoint[];
  days: number;
  thresholds: { warning: number; alert: number } | null;
}

export function RiskTrendChart({ trend, days, thresholds }: Props) {
  const data = trend.map((point) => ({ date: point.date, ...point.scores }));

  return (
    <section aria-label="リスク推移">
      <h2 className="mb-3 text-lg font-semibold text-fg">リスク推移（{days}日間）</h2>
      {data.length === 0 ? (
        <EmptyState title="リスク推移データがまだありません" />
      ) : (
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={chartMargin}>
              <ChartGrid />
              <ChartXAxis dataKey="date" />
              <ChartYAxis domain={[0, 100]} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={CHART_ALERT_SCORE} stroke={chartColors.danger} strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={CHART_WARNING_SCORE} stroke={chartColors.warning} strokeDasharray="3 3" strokeOpacity={0.3} />
              {thresholds && (
                <>
                  <ReferenceLine
                    y={thresholds.alert}
                    stroke={PERSONAL_ALERT_COLOR}
                    strokeDasharray="6 3"
                    strokeOpacity={0.6}
                    label={{ value: 'あなたの警戒', position: 'right', fill: PERSONAL_ALERT_COLOR, fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={thresholds.warning}
                    stroke={PERSONAL_WARNING_COLOR}
                    strokeDasharray="6 3"
                    strokeOpacity={0.4}
                    label={{ value: 'あなたの注意', position: 'right', fill: PERSONAL_WARNING_COLOR, fontSize: 10 }}
                  />
                </>
              )}
              {RISK_CATEGORIES.map((cat) => (
                <Line
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stroke={CATEGORY_COLORS[cat]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={categoryLabels[cat]}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

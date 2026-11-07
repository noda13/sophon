import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer } from 'recharts';
import { Card } from '../../../ui/Card';
import { EmptyState } from '../../../ui/EmptyState';
import { ChartTooltip, ChartXAxis, ChartYAxis, chartColors, chartMargin } from '../../../ui/chart';
import type { FinancialPoint } from '../logic/chart';
import { t } from '../logic/i18n';

const SERIES = [
  { key: 'netSales', name: t('chartNetSales'), color: chartColors.info },
  { key: 'profit', name: t('chartProfit'), color: chartColors.success },
  { key: 'cash', name: t('chartCash'), color: chartColors.warning },
  { key: 'equity', name: t('chartEquity'), color: chartColors.accent },
] as const;

export function FinancialChart({ points }: { points: readonly FinancialPoint[] }) {
  if (points.length === 0) {
    return (
      <Card title={t('financialChart')}>
        <EmptyState title={t('noFinancialData')} />
      </Card>
    );
  }

  return (
    <Card title={t('financialChart')}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={[...points]} margin={chartMargin}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
          <ChartXAxis dataKey="period" />
          <ChartYAxis />
          <ChartTooltip />
          <Legend />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

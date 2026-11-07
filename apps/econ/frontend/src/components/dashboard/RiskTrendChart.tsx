import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchRiskHistory } from '../../services/api';
import { categoryLabels, RISK_CATEGORIES } from '../../lib/riskColors';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { getPersonalizedThresholds } from '../../lib/personalizedRisk';
import { CHART_ALERT_SCORE, CHART_WARNING_SCORE } from '../../lib/riskThresholds';

const CATEGORY_COLORS: Record<string, string> = {
  currency_finance: '#f87171',
  geopolitics_supply_chain: '#fb923c',
  technology: '#60a5fa',
  social_policy: '#a78bfa',
};

const HISTORY_DAYS = 30;

function toLocalDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | undefined;
}

export function RiskTrendChart() {
  const { profile } = useUserProfile();
  const thresholds = profile ? getPersonalizedThresholds(profile) : null;

  const { histories, isLoading, isError } = useQueries({
    queries: RISK_CATEGORIES.map((cat) => ({
      queryKey: ['riskHistory', cat, HISTORY_DAYS],
      queryFn: () => fetchRiskHistory(cat, HISTORY_DAYS),
    })),
    combine: (results) => ({
      histories: results.map((r) => r.data),
      isLoading: results.some((r) => r.isLoading),
      isError: results.some((r) => r.isError),
    }),
  });

  const chartData = useMemo(() => {
    const dataMap = new Map<string, ChartDataPoint>();
    RISK_CATEGORIES.forEach((cat, i) => {
      for (const item of histories[i] ?? []) {
        const d = new Date(item.assessedAt);
        const dateKey = toLocalDateKey(d);
        const point = dataMap.get(dateKey) || {
          date: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        };
        point[cat] = item.score;
        dataMap.set(dateKey, point);
      }
    });
    return Array.from(dataMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [histories]);

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center text-red-400 text-sm">
        リスク推移データの取得に失敗しました
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center text-gray-500 text-sm">
        リスク推移データがまだありません
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-200 mb-3">リスク推移（{HISTORY_DAYS}日間）</h2>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} stroke="#6b7280" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#d1d5db' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <ReferenceLine y={CHART_ALERT_SCORE} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={CHART_WARNING_SCORE} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.3} />
            {thresholds && (
              <>
                <ReferenceLine
                  y={thresholds.alert}
                  stroke="#f472b6"
                  strokeDasharray="6 3"
                  strokeOpacity={0.6}
                  label={{ value: 'あなたの警戒', position: 'right', fill: '#f472b6', fontSize: 10 }}
                />
                <ReferenceLine
                  y={thresholds.warning}
                  stroke="#c084fc"
                  strokeDasharray="6 3"
                  strokeOpacity={0.4}
                  label={{ value: 'あなたの注意', position: 'right', fill: '#c084fc', fontSize: 10 }}
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
    </div>
  );
}

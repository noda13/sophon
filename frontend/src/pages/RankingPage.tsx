import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchStrategyRanking, fetchStrategies } from '../services/api';
import { formatYen, formatRatio, formatPer } from '../lib/formatters';
import { t } from '../lib/i18n';
import type { RankingRow, StrategyMeta, StrategyId } from '../lib/types';

function NCRBadge({ value }: { value: number | null }) {
  const color =
    value !== null && value >= 1.0
      ? 'bg-green-700 text-green-100'
      : value !== null && value >= 0.3
        ? 'bg-yellow-700 text-yellow-100'
        : 'bg-gray-700 text-gray-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${color}`}>
      {value !== null ? formatRatio(value) : '—'}
    </span>
  );
}

function ScoreBadge({ score, reason }: { score: number; reason: string }) {
  const color =
    score >= 75
      ? 'bg-green-700 text-green-100'
      : score >= 55
        ? 'bg-blue-700 text-blue-100'
        : score >= 40
          ? 'bg-yellow-700 text-yellow-100'
          : 'bg-gray-700 text-gray-400';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold cursor-help ${color}`}
      title={reason}
    >
      {score}
    </span>
  );
}

export function RankingPage() {
  const [searchParams] = useSearchParams();
  const VALID_STRATEGIES: readonly StrategyId[] = ['kiyohara', 'graham', 'buffett', 'lynch', 'dividend', 'composite'];
  const rawStrategy = searchParams.get('strategy');
  const strategyId: StrategyId = VALID_STRATEGIES.includes(rawStrategy as StrategyId)
    ? (rawStrategy as StrategyId)
    : 'kiyohara';

  const strategiesQuery = useQuery<StrategyMeta[]>({
    queryKey: ['strategies'],
    queryFn: fetchStrategies,
    staleTime: 10 * 60 * 1000,
  });
  const currentStrategyMeta = strategiesQuery.data?.find(s => s.id === strategyId);

  const { data, isLoading, isError, error } = useQuery<RankingRow[]>({
    queryKey: ['strategy-ranking', strategyId],
    queryFn: () => fetchStrategyRanking(strategyId, { limit: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">{t('loading')}</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-lg p-4">
        <p className="text-red-200">
          {t('fetchError')}: {error instanceof Error ? error.message : t('unknownError')}
        </p>
        <p className="text-red-400 text-sm mt-1">
          {t('syncHint')} (<code className="bg-red-800 px-1 rounded">{t('syncCommand')}</code> {t('syncInstruction')})
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-lg">{t('noData')}</p>
        <p className="text-gray-500 text-sm mt-2">
          <code className="bg-gray-700 px-2 py-1 rounded">{t('syncCommand')}</code>{' '}
          {t('syncInstruction')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          {currentStrategyMeta?.displayName ?? strategyId}{t('rankingTitle')}
          <span className="ml-2 text-sm font-normal text-gray-400">{t('rankingSubtitle')}</span>
        </h2>
        {currentStrategyMeta?.description && (
          <p className="text-gray-400 text-sm mt-1">{currentStrategyMeta.description}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-right py-3 px-2 w-12">{t('colRank')}</th>
              <th className="text-left py-3 px-2 w-16">{t('colCode')}</th>
              <th className="text-left py-3 px-2">{t('colName')}</th>
              <th className="text-left py-3 px-2">{t('colSector')}</th>
              <th className="text-right py-3 px-2">{t('colMarketCap')}</th>
              <th className="text-right py-3 px-2">{t('colNetCash')}</th>
              <th className="text-right py-3 px-2">{t('colNcr')}</th>
              <th className="text-right py-3 px-2">{t('colCnper')}</th>
              <th className="text-right py-3 px-2">{t('colPer')}</th>
              <th className="text-right py-3 px-2">{t('colScore')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: RankingRow) => (
              <tr
                key={row.code}
                className="border-b border-gray-800 hover:bg-gray-800 transition-colors"
              >
                <td className="text-right py-3 px-2 text-gray-500">{row.rank}</td>
                <td className="py-3 px-2">
                  <Link
                    to={`/stock/${row.code}`}
                    className="font-mono text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {row.code}
                  </Link>
                </td>
                <td className="py-3 px-2 font-medium">{row.name}</td>
                <td className="py-3 px-2 text-gray-400 text-xs">{row.sector33Name ?? '—'}</td>
                <td className="text-right py-3 px-2 font-mono text-gray-300">
                  {formatYen(row.marketCap)}
                </td>
                <td
                  className={`text-right py-3 px-2 font-mono ${row.netCash !== null && row.netCash >= 0 ? 'text-green-400' : row.netCash !== null ? 'text-red-400' : 'text-gray-400'}`}
                >
                  {formatYen(row.netCash)}
                </td>
                <td className="text-right py-3 px-2">
                  <NCRBadge value={row.netCashRatio} />
                </td>
                <td className="text-right py-3 px-2 font-mono text-gray-300">
                  {formatPer(row.cashNeutralPer)}
                </td>
                <td className="text-right py-3 px-2 font-mono text-gray-400">
                  {formatPer(row.per)}
                </td>
                <td className="text-right py-3 px-2">
                  <ScoreBadge
                    score={row.strategyScore?.score ?? 0}
                    reason={row.strategyScore?.reason ?? ''}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-600">
        {t('dataFetchedAt')}:{' '}
        {data[0]?.snapshotAt ? new Date(data[0].snapshotAt).toLocaleString('ja-JP') : '—'}
      </p>
    </div>
  );
}

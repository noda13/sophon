import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchStrategyRanking } from '../services/api';
import { formatYen, formatRatio, formatPer } from '../lib/formatters';
import type { RankingRow } from '../lib/types';

function NCRBadge({ value }: { value: number }) {
  const color =
    value >= 1.0
      ? 'bg-green-700 text-green-100'
      : value >= 0.3
        ? 'bg-yellow-700 text-yellow-100'
        : 'bg-gray-700 text-gray-300';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${color}`}>
      {formatRatio(value)}
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
  const strategyId = searchParams.get('strategy') ?? 'kiyohara';

  const { data, isLoading, isError, error } = useQuery<RankingRow[]>({
    queryKey: ['strategy-ranking', strategyId],
    queryFn: () => fetchStrategyRanking(strategyId, { limit: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">読み込み中...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-lg p-4">
        <p className="text-red-200">
          データ取得エラー: {error instanceof Error ? error.message : '不明なエラー'}
        </p>
        <p className="text-red-400 text-sm mt-1">
          バックエンドが起動しているか確認してください (POST /api/admin/sync で同期)
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-lg">データがありません</p>
        <p className="text-gray-500 text-sm mt-2">
          <code className="bg-gray-700 px-2 py-1 rounded">POST /api/admin/sync</code>{' '}
          を実行してデータを同期してください
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          清原流ランキング
          <span className="ml-2 text-sm font-normal text-gray-400">（スコア降順）</span>
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          NCR = NetCash / 時価総額　|　NCR &gt; 1.0 = 超割安水準（清原流）　|　スコアにカーソルで評価理由を表示
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="text-right py-3 px-2 w-12">順位</th>
              <th className="text-left py-3 px-2 w-16">コード</th>
              <th className="text-left py-3 px-2">銘柄名</th>
              <th className="text-left py-3 px-2">業種</th>
              <th className="text-right py-3 px-2">時価総額</th>
              <th className="text-right py-3 px-2">NetCash</th>
              <th className="text-right py-3 px-2">NCR</th>
              <th className="text-right py-3 px-2">CNPER</th>
              <th className="text-right py-3 px-2">PER</th>
              <th className="text-right py-3 px-2">スコア</th>
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
                  className={`text-right py-3 px-2 font-mono ${row.netCash >= 0 ? 'text-green-400' : 'text-red-400'}`}
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
                    score={row.strategyScore.score}
                    reason={row.strategyScore.reason}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-600">
        データ取得:{' '}
        {data[0]?.snapshotAt ? new Date(data[0].snapshotAt).toLocaleString('ja-JP') : '—'}
      </p>
    </div>
  );
}

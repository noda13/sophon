import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchStockDetail, fetchStockHistory, fetchStockStrategies } from '../services/api';
import { formatYen, formatRatio, formatPer } from '../lib/formatters';
import type { FinancialStatement, StockProfile, StrategyScore } from '../lib/types';

// --- Score Bar ---

function ScoreBar({ label, scoreObj }: { label: string; scoreObj: StrategyScore }) {
  const { score, reason } = scoreObj;
  const color =
    score >= 75
      ? 'bg-green-600'
      : score >= 55
        ? 'bg-blue-600'
        : score >= 40
          ? 'bg-yellow-600'
          : 'bg-gray-600';

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-semibold">{label}</span>
        <span className="text-2xl font-mono font-bold text-white">{score}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
        <div
          className={`h-3 rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-gray-400 text-xs">{reason}</p>
    </div>
  );
}

// --- External Links ---

function ExternalLinks({ code }: { code: string }) {
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const safeCode = encodeURIComponent(code);

  const links = [
    {
      label: 'kabutan',
      url: `https://kabutan.jp/stock/?code=${safeCode}`,
      description: '株価・ニュース',
    },
    {
      label: 'IR BANK',
      url: `https://irbank.net/E${safeCode}/financials`,
      description: '財務データ推移',
    },
    {
      label: 'EDINET',
      url: `https://disclosure2.edinet-fsa.go.jp/WEEK0010.aspx?bikou2=${safeCode}`,
      description: '有価証券報告書',
    },
    {
      label: 'TDnet',
      url: `https://www.release.tdnet.info/inbs/I_list_001_${yyyymmdd}.html`,
      description: '適時開示（本日）',
    },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-3">外部リンク</h3>
      <div className="grid grid-cols-2 gap-2">
        {links.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col px-3 py-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
          >
            <span className="text-blue-400 text-sm font-semibold">{link.label}</span>
            <span className="text-gray-400 text-xs">{link.description}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// --- Financial Chart ---

function FinancialChart({ history }: { history: FinancialStatement[] }) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.disclosedDate).getTime() - new Date(b.disclosedDate).getTime()
  );

  const chartData = sorted.map(s => ({
    period: `${s.fiscalYear}${s.typeOfCurrentPeriod !== 'FY' ? s.typeOfCurrentPeriod : ''}`,
    売上: s.netSales !== null ? s.netSales / 100_000_000 : null,
    利益: s.profit !== null ? s.profit / 100_000_000 : null,
    現預金: s.cashAndEquivalents !== null ? s.cashAndEquivalents / 100_000_000 : null,
    純資産: s.equity !== null ? s.equity / 100_000_000 : null,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-4">財務推移（単位：億円）</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="period" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#F9FAFB' }}
            itemStyle={{ color: '#D1D5DB' }}
          />
          <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          <Line type="monotone" dataKey="売上" stroke="#60A5FA" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="利益" stroke="#34D399" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="現預金" stroke="#FBBF24" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="純資産" stroke="#A78BFA" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Profile Card ---

function ProfileCard({ profile }: { profile: StockProfile }) {
  const latestSnapshot = profile.snapshots?.[0];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-blue-400 text-lg">{profile.code}</span>
            {profile.marketSegment && (
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                {profile.marketSegment}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white mt-1">{profile.name}</h2>
          {profile.sector33Name && (
            <p className="text-gray-400 text-sm mt-0.5">{profile.sector33Name}</p>
          )}
        </div>
        <div className="text-right text-sm text-gray-500">
          更新: {new Date(profile.updatedAt).toLocaleDateString('ja-JP')}
        </div>
      </div>

      {latestSnapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">時価総額</div>
            <div className="text-white font-mono">{formatYen(latestSnapshot.marketCap)}</div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">ネットキャッシュ</div>
            <div className={`font-mono ${latestSnapshot.netCash >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatYen(latestSnapshot.netCash)}
            </div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">NCR</div>
            <div className={`font-mono font-bold ${latestSnapshot.netCashRatio >= 1.0 ? 'text-green-400' : latestSnapshot.netCashRatio >= 0.3 ? 'text-yellow-400' : 'text-gray-300'}`}>
              {formatRatio(latestSnapshot.netCashRatio)}
            </div>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs mb-1">CNPER</div>
            <div className="text-white font-mono">{formatPer(latestSnapshot.cashNeutralPer)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export function StockDetailPage() {
  const { code } = useParams<{ code: string }>();

  const profileQuery = useQuery({
    queryKey: ['stock-profile', code],
    queryFn: () => fetchStockDetail(code!),
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  });

  const historyQuery = useQuery({
    queryKey: ['stock-history', code],
    queryFn: () => fetchStockHistory(code!),
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  });

  const strategiesQuery = useQuery({
    queryKey: ['stock-strategies', code],
    queryFn: () => fetchStockStrategies(code!),
    enabled: !!code,
    staleTime: 5 * 60 * 1000,
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg">読み込み中...</div>
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-lg p-4">
        <p className="text-red-200">
          銘柄データの取得に失敗しました:{' '}
          {profileQuery.error instanceof Error ? profileQuery.error.message : '不明なエラー'}
        </p>
        <Link to="/" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
          ← ランキングに戻る
        </Link>
      </div>
    );
  }

  const profile = profileQuery.data;
  const history = historyQuery.data ?? [];
  const strategyScores = strategiesQuery.data ?? {};

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
        ← ランキングに戻る
      </Link>

      {/* Profile */}
      <ProfileCard profile={profile} />

      {/* Two-column layout for chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2">
          {history.length > 0 ? (
            <FinancialChart history={history} />
          ) : (
            <div className="bg-gray-800 rounded-lg p-4 text-gray-400 text-center h-40 flex items-center justify-center">
              財務データがありません
            </div>
          )}
        </div>

        {/* Sidebar: External Links */}
        <div>
          <ExternalLinks code={code!} />
        </div>
      </div>

      {/* Strategy Scores */}
      {Object.keys(strategyScores).length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-3">投資視点スコア</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(strategyScores).map(([id, scoreObj]) => {
              const labelMap: Record<string, string> = {
                kiyohara: '清原流',
                graham: 'グレアム',
                buffett: 'バフェット',
                lynch: 'リンチ',
                dividend: '配当',
              };
              return (
                <ScoreBar
                  key={id}
                  label={labelMap[id] ?? id}
                  scoreObj={scoreObj as StrategyScore}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

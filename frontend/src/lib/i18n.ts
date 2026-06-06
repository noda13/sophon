/**
 * Type-safe Japanese message catalog.
 *
 * Usage:
 *   import { t } from '../lib/i18n';
 *   <p>{t('loading')}</p>
 *   <p>{t('fetchError')}: {error.message}</p>
 *
 * To add a message: add a key to `ja` below. TypeScript will enforce usage.
 */

const ja = {
  // Common
  loading: '読み込み中...',
  fetchError: 'データ取得エラー',
  unknownError: '不明なエラー',
  noData: 'データがありません',
  backToRanking: '← ランキングに戻る',
  updatedAt: '更新',
  dataFetchedAt: 'データ取得',

  // RankingPage
  rankingTitle: 'ランキング',
  rankingSubtitle: '（スコア降順）',
  syncHint: 'バックエンドが起動しているか確認してください',
  syncCommand: 'POST /api/admin/sync',
  syncInstruction: 'を実行してデータを同期してください',

  // RankingPage table headers
  colRank: '順位',
  colCode: 'コード',
  colName: '銘柄名',
  colSector: '業種',
  colMarketCap: '時価総額',
  colNetCash: 'NetCash',
  colNcr: 'NCR',
  colCnper: 'CNPER',
  colPer: 'PER',
  colScore: 'スコア',

  // StockDetailPage
  stockFetchFailed: '銘柄データの取得に失敗しました',
  financialChart: '財務推移（単位：億円）',
  externalLinks: '外部リンク',
  investmentScores: '投資視点スコア',
  noFinancialData: '財務データがありません',
  financialFetchFailed: '財務データ取得に失敗しました',
  scoreFetchFailed: 'スコアデータ取得に失敗しました',

  // ProfileCard metric labels
  metricMarketCap: '時価総額',
  metricNetCash: 'ネットキャッシュ',
  metricNcr: 'NCR',
  metricCnper: 'CNPER',

  // StrategySelector
  strategyLabel: '視点',
  strategyFetchError: 'データ取得エラー',

  // AppLayout
  tagline: '清原流バリュー・スクリーナー',
  disclaimer: '本ツールは投資判断支援を目的とし、個別銘柄の推奨ではありません。投資に関する最終判断はご自身の責任で行ってください。',
} as const;

export type MessageKey = keyof typeof ja;

export function t(key: MessageKey): string {
  return ja[key];
}

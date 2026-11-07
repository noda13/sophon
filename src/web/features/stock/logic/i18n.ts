const ja = {
  rankingTitle: 'ランキング',
  rankingSubtitle: '（スコア降順）',
  noData: 'データがありません',
  noMatch: '条件に合う銘柄がありません',
  fetchError: 'データ取得エラー',
  unknownError: '不明なエラー',
  dataFetchedAt: 'データ取得',
  updatedAt: '更新',
  backToRanking: '← ランキングに戻る',

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

  strategyLabel: '視点',
  searchLabel: 'コード・銘柄名・業種で検索',
  minMarketCapLabel: '時価総額の下限（億円）',
  maxMarketCapLabel: '時価総額の上限（億円）',
  excludeSectorsLabel: '除外する業種',
  excludeSectorsNone: '除外なし',
  resetFilters: '絞り込みを解除',
  resultCount: '件',

  stockFetchFailed: '銘柄データの取得に失敗しました',
  financialChart: '財務推移（単位：億円）',
  externalLinks: '外部リンク',
  investmentScores: '投資視点スコア',
  noFinancialData: '財務データがありません',

  metricMarketCap: '時価総額',
  metricNetCash: 'ネットキャッシュ',
  metricNcr: 'NCR',
  metricCnper: 'CNPER',

  chartNetSales: '売上',
  chartProfit: '利益',
  chartCash: '現預金',
  chartEquity: '純資産',
} as const;

export type MessageKey = keyof typeof ja;

export function t(key: MessageKey): string {
  return ja[key];
}

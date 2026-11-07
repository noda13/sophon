import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed skipped: NODE_ENV is production');
    return;
  }

  const [riskCount, newsCount, indicatorCount] = await Promise.all([
    prisma.riskAssessment.count(),
    prisma.newsArticle.count(),
    prisma.economicIndicator.count(),
  ]);
  if (riskCount > 0 || newsCount > 0 || indicatorCount > 0) {
    console.log('Seed skipped: database already has data');
    return;
  }

  const now = new Date();
  const categories = [
    {
      category: 'currency_finance',
      score: 62,
      level: 'high',
      summaryJa: '米国の関税政策強化によりドル安圧力が継続。日銀の利上げ観測と相まって円高リスクが高まっている。欧州銀行セクターの信用リスクにも注意が必要。',
      factorsJa: JSON.stringify([
        '米ドル指数が年初来安値を更新',
        '日銀の追加利上げ観測の高まり',
        '欧州銀行セクターのCDS拡大',
        '新興国通貨の対ドル下落加速',
        '金価格が史上最高値を更新'
      ]),
    },
    {
      category: 'geopolitics_supply_chain',
      score: 71,
      level: 'high',
      summaryJa: '米中貿易摩擦が激化し、半導体・レアアース供給に影響。中東情勢の緊迫化によりエネルギー価格が不安定化。食料安全保障への懸念も高まっている。',
      factorsJa: JSON.stringify([
        '米国の対中関税145%への引き上げ',
        '中国による報復関税の発動',
        '中東地域の紛争リスク継続',
        'レアアース輸出規制の強化',
        '世界的な食料価格指数の上昇'
      ]),
    },
    {
      category: 'technology',
      score: 45,
      level: 'elevated',
      summaryJa: 'AI規制の国際的な枠組み議論が活発化。サイバー攻撃の増加と半導体供給制約が継続するが、デジタルインフラ投資は堅調。',
      factorsJa: JSON.stringify([
        'EU AI規制法の施行開始',
        '重要インフラへのサイバー攻撃増加',
        '先端半導体の供給制約継続',
        'CBDC実証実験の加速',
      ]),
    },
    {
      category: 'social_policy',
      score: 38,
      level: 'moderate',
      summaryJa: '主要国の財政政策は拡張的だが、インフレ圧力により金融引き締めが継続。人口動態の変化が労働市場に影響を与えている。',
      factorsJa: JSON.stringify([
        '主要中央銀行の金融引き締め継続',
        '先進国の財政赤字拡大',
        '労働力不足の構造的問題',
        '社会保障制度の持続可能性への懸念',
      ]),
    },
  ];

  const articles = [
    {
      sourceId: 'seed-1',
      source: 'reuters',
      originalTitle: 'Fed signals extended pause as inflation persists',
      originalUrl: 'https://example.com/fed-pause',
      publishedAt: new Date('2026-04-12T06:00:00Z'),
      summaryJa: 'FRBはインフレ率が目標を上回る中、利下げを急がない姿勢を改めて示した。パウエル議長は経済データに基づく慎重なアプローチを強調。',
      relevanceScore: 90,
      riskCategories: JSON.stringify(['currency_finance', 'social_policy']),
    },
    {
      sourceId: 'seed-2',
      source: 'nhk',
      originalTitle: '日銀 追加利上げの可能性を示唆',
      originalUrl: 'https://example.com/boj-rate',
      publishedAt: new Date('2026-04-12T03:00:00Z'),
      summaryJa: '日本銀行の植田総裁は、経済・物価情勢が見通しに沿って推移すれば追加利上げを検討する考えを示した。市場では年内の利上げ観測が強まっている。',
      relevanceScore: 95,
      riskCategories: JSON.stringify(['currency_finance']),
    },
    {
      sourceId: 'seed-3',
      source: 'reuters',
      originalTitle: 'US-China tariff escalation disrupts global supply chains',
      originalUrl: 'https://example.com/tariff-war',
      publishedAt: new Date('2026-04-11T18:00:00Z'),
      summaryJa: '米中間の関税引き上げ合戦が激化し、グローバルサプライチェーンに混乱が広がっている。半導体、レアアース、農産物の貿易に大きな影響。',
      relevanceScore: 92,
      riskCategories: JSON.stringify(['geopolitics_supply_chain', 'technology']),
    },
    {
      sourceId: 'seed-4',
      source: 'imf',
      originalTitle: 'IMF warns of growing debt vulnerabilities in emerging markets',
      originalUrl: 'https://example.com/imf-debt',
      publishedAt: new Date('2026-04-11T12:00:00Z'),
      summaryJa: 'IMFは新興国の債務脆弱性が拡大していると警告。高金利環境の長期化により、複数の新興国で債務持続可能性に懸念が高まっている。',
      relevanceScore: 85,
      riskCategories: JSON.stringify(['currency_finance', 'social_policy']),
    },
    {
      sourceId: 'seed-5',
      source: 'reuters',
      originalTitle: 'Gold hits record high as investors seek safe haven',
      originalUrl: 'https://example.com/gold-record',
      publishedAt: new Date('2026-04-11T08:00:00Z'),
      summaryJa: '金価格が史上最高値を更新。地政学的リスクの高まりとドル安を背景に、安全資産への逃避が加速している。',
      relevanceScore: 88,
      riskCategories: JSON.stringify(['currency_finance', 'geopolitics_supply_chain']),
    },
  ];

  const indicators = [
    { code: 'VIX', name: 'VIX恐怖指数', value: 28.5, previousValue: 24.2, unit: '', source: 'fred', recordedAt: now },
    { code: 'USDJPY', name: 'ドル円', value: 142.35, previousValue: 148.20, unit: '円', source: 'openexchangerates', recordedAt: now },
    { code: 'US_CPI', name: '米国CPI（前年比）', value: 3.2, previousValue: 3.0, unit: '%', source: 'fred', recordedAt: now },
    { code: 'US_FFR', name: '米国政策金利', value: 5.25, previousValue: 5.25, unit: '%', source: 'fred', recordedAt: now },
    { code: 'GOLD', name: '金価格', value: 3245.0, previousValue: 3105.0, unit: 'USD/oz', source: 'yahoo', recordedAt: now },
    { code: 'US10Y', name: '米10年国債利回り', value: 4.38, previousValue: 4.25, unit: '%', source: 'fred', recordedAt: now },
    { code: 'BTC', name: 'ビットコイン', value: 82500.0, previousValue: 78200.0, unit: 'USD', source: 'coingecko', recordedAt: now },
  ];

  await prisma.$transaction([
    ...categories.map((cat) =>
      prisma.riskAssessment.create({ data: { ...cat, assessedAt: now } }),
    ),
    ...articles.map((article) => prisma.newsArticle.create({ data: article })),
    ...indicators.map((ind) => prisma.economicIndicator.create({ data: ind })),
  ]);

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function makeSourceId(url: string, title: string): string {
  return createHash('sha256').update(`${url}:${title.slice(0, 32)}`).digest('hex');
}

const now = new Date();
const yesterday = new Date(now.getTime() - 86400_000);
const twoDaysAgo = new Date(now.getTime() - 172800_000);

const seeds = [
  // 1. Housing cost crisis (no idea generated yet — classified only)
  {
    sourceId: makeSourceId('https://www.nhk.or.jp/news/html/seed001.html', '住宅費高騰で若者の自立が困難に'),
    source: 'nhk',
    sourceType: 'news_jp',
    originalTitle: '住宅費高騰で若者の自立が困難に――都市部で月収の5割超える家賃も',
    originalUrl: 'https://www.nhk.or.jp/news/html/seed001.html',
    publishedAt: twoDaysAgo,
    rawContent:
      '東京・大阪などの大都市圏では、家賃が急騰しており、20代の若者の多くが月収の50%以上を住宅費として支出しているという調査結果が発表された。特に単身世帯では、手取り20万円でも10万円以上の家賃を求められるケースが増え、貯蓄どころか生活費が不足する状況に陥る若者が続出している。',
    summaryJa:
      '都市部の家賃高騰により、20代の若者の多くが月収の50%以上を住居費に充てる状況に追い込まれている。特に単身赴任者や新卒者が手頃な物件を見つけられず、自立した生活の維持が困難になっている。',
    category: 'employment_economy',
    severityScore: 72,
    urgencyScore: 65,
    appifiabilityScore: 55,
    affectedDomain: JSON.stringify(['若者', '住宅', '賃貸', '都市部', '経済的困窮']),
    classifiedAt: yesterday,
    proposedAppIdea: '',
    mvpFeatures: JSON.stringify([]),
    targetUsers: '',
    difficulty: '',
    ideaGeneratedAt: null,
  },

  // 2. Nursing care staff shortage (classified + idea generated)
  {
    sourceId: makeSourceId('https://www.asahi.com/articles/seed002.html', '介護人材不足が深刻化、2025年問題'),
    source: 'asahi',
    sourceType: 'news_jp',
    originalTitle: '介護人材不足が深刻化――2025年問題で施設閉鎖も、担い手確保が急務',
    originalUrl: 'https://www.asahi.com/articles/seed002.html',
    publishedAt: twoDaysAgo,
    rawContent:
      '団塊の世代が全員75歳以上となる2025年を迎え、介護サービスの需要が急増している一方、介護職員の不足が深刻化している。厚生労働省の推計では、2025年末までに約32万人の介護人材が不足する見通し。離職率の高さと低賃金が担い手確保の障壁となっており、一部の介護施設では受け入れ制限や閉鎖を余儀なくされている。',
    summaryJa:
      '2025年問題により介護需要が急増するなか、約32万人規模の介護職員不足が現実のものとなっている。低賃金と高い離職率が構造的な問題であり、一部施設では閉鎖も起きており、高齢者や家族介護者が必要なサービスを受けられない状況が生じている。',
    category: 'aging_care',
    severityScore: 88,
    urgencyScore: 82,
    appifiabilityScore: 75,
    affectedDomain: JSON.stringify(['高齢者', '介護', '介護職員', '施設', '2025年問題']),
    classifiedAt: yesterday,
    proposedAppIdea:
      '介護職員のシフト管理と求職者マッチングを一体化したプラットフォーム。施設側は即戦力の登録スタッフを必要な日時だけ確保でき、介護士は空き時間に柔軟に働ける仕組みを提供する。',
    mvpFeatures: JSON.stringify([
      '介護士プロフィール・資格登録機能',
      '施設からのスポットシフト募集掲示板',
      'リアルタイムマッチング通知（プッシュ）',
      '勤務実績・評価レビュー機能',
      '給与即日払いと明細確認機能',
    ]),
    targetUsers:
      '副業・フリーランスとして働きたい有資格介護士、および慢性的な人員不足に悩む介護施設の運営者',
    difficulty: 'medium',
    ideaGeneratedAt: yesterday,
  },

  // 3. School bullying (classified + idea generated)
  {
    sourceId: makeSourceId('https://www.mext.go.jp/news/seed003.html', 'いじめ認知件数が過去最多を更新'),
    source: 'cao',
    sourceType: 'gov',
    originalTitle: 'いじめ認知件数が過去最多を更新――SNS起因の深刻事案も増加、文科省調査',
    originalUrl: 'https://www.mext.go.jp/news/seed003.html',
    publishedAt: yesterday,
    rawContent:
      '文部科学省が発表した令和5年度の「児童生徒の問題行動・不登校等生徒指導上の諸課題に関する調査」によると、いじめの認知件数は前年度を上回り過去最多を更新した。特にSNSや通信アプリを使ったいじめ（ネットいじめ）が急増しており、深刻度の高い事案も増加している。一方で被害を受けた児童生徒が相談できる環境が不十分との指摘も多い。',
    summaryJa:
      'いじめの認知件数が過去最多を更新し、とりわけSNS起因のネットいじめが急増している。被害児童が相談できる窓口や環境が不足しており、深刻化する前に問題を発見・介入する仕組みが求められている。',
    category: 'education',
    severityScore: 81,
    urgencyScore: 78,
    appifiabilityScore: 82,
    affectedDomain: JSON.stringify(['子ども', 'いじめ', 'SNS', '学校', '不登校', '相談窓口']),
    classifiedAt: now,
    proposedAppIdea:
      '児童が匿名でいじめ被害を報告・相談できるアプリ。AI感情分析で深刻度を自動評価し、担任や専門カウンセラーへのエスカレーションを自動化する。保護者・学校・自治体が連携してケースを管理できるダッシュボードも提供する。',
    mvpFeatures: JSON.stringify([
      '匿名いじめ報告フォーム（テキスト・写真対応）',
      'AI感情分析による深刻度スコアリング',
      '担任・学校管理者へのアラート通知',
      '保護者向けの状況確認ポータル',
      'チャット形式の24時間AIカウンセリング（一次対応）',
    ]),
    targetUsers:
      '小中学生およびその保護者、ならびに生徒指導担当教員や学校カウンセラー',
    difficulty: 'medium',
    ideaGeneratedAt: now,
  },
];

async function main(): Promise<void> {
  console.log('[Seed] Inserting sample issues...');

  for (const seed of seeds) {
    await prisma.issue.upsert({
      where: { sourceId: seed.sourceId },
      update: {},
      create: seed,
    });
  }

  console.log(`[Seed] Done. Inserted/skipped ${seeds.length} sample issues.`);
}

main()
  .catch((err) => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

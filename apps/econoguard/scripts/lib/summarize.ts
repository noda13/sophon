import { z } from 'zod';
import { RISK_CATEGORIES } from '../../backend/src/schemas/riskConstants.js';
import { callLLM, parseJson } from './llm.js';
import { MAX_SUMMARY_ATTEMPTS, type NewsArticle } from './types.js';

export { MAX_SUMMARY_ATTEMPTS };

const BATCH_DELAY_MS = 30_000;

const SYS = `あなたはグローバル経済リスクアナリストです。与えられたニュース記事を分析し、JSON形式で応答してください。

各記事について:
- summaryJa: 日本語で2-3文の簡潔な要約（マクロ経済・金融市場への影響を中心に）
- relevanceScore: グローバル経済リスクとの関連度（0-100の整数）。以下の基準で厳格に評価:
  - 70-100: マクロ経済に直接影響（金融政策変更、通貨危機、貿易摩擦、地政学的衝突、主要指標の大幅変動）
  - 40-69: 間接的だが無視できない影響（業界全体の規制変更、主要企業の業績が市場に波及）
  - 10-29: 影響が限定的またはローカル（個別企業人事、地方ニュース、小規模イベント）
  - 0-9: 経済リスクと無関係
- riskCategories: 関連するカテゴリの配列。選択肢: "currency_finance", "geopolitics_supply_chain", "technology", "social_policy"
  relevanceScoreが30未満の記事は空配列[]にしてください。

応答は必ず以下のJSON形式: {"results":[{"index":0,"summaryJa":"...","relevanceScore":80,"riskCategories":["currency_finance"]}]}`;

const summaryItemSchema = z.object({
  index: z.number().int().min(0),
  summaryJa: z.string().trim().min(1),
  relevanceScore: z.number().int().min(0).max(100),
  riskCategories: z.array(z.enum(RISK_CATEGORIES)),
});
const summaryResponseSchema = z.object({ results: z.array(z.unknown()) });

const MAX_PER_RUN = 50;

export async function summarize(articles: NewsArticle[]): Promise<{ attempted: number; failed: number }> {
  const todo = articles.filter(a => !a.summaryJa && (a.summaryAttempts ?? 0) < MAX_SUMMARY_ATTEMPTS);
  const targets = todo.slice(0, MAX_PER_RUN);
  if (!todo.length) return { attempted: 0, failed: 0 };

  for (let i = 0; i < Math.min(todo.length, MAX_PER_RUN); i += 10) {
    const batch = todo.slice(i, i + 10);
    const msg = batch.map((a, j) => `[${j}] ${a.source}: ${a.originalTitle}`).join('\n');
    try {
      const raw = await callLLM(SYS, msg);
      const parsed = parseJson(raw);
      const { results: rawItems } = summaryResponseSchema.parse(parsed);

      let accepted = 0;
      for (const item of rawItems) {
        const res = summaryItemSchema.safeParse(item);
        if (!res.success) {
          console.warn('[summarize] Dropping invalid result entry:', res.error.issues);
          continue;
        }
        const r = res.data;
        if (batch[r.index]) {
          batch[r.index].summaryJa = r.summaryJa;
          batch[r.index].relevanceScore = r.relevanceScore;
          batch[r.index].riskCategories = r.riskCategories;
          accepted++;
        }
      }
      console.log(`  Batch ${Math.floor(i / 10) + 1} done (${accepted} summarized)`);
    } catch (e) { console.error('  Summarize failed:', e instanceof Error ? e.message : e); }
    // A permanently failing article would otherwise occupy the per-run budget and news.json forever.
    for (const a of batch) {
      if (!a.summaryJa) a.summaryAttempts = (a.summaryAttempts ?? 0) + 1;
    }
    if (i + 10 < todo.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
  return { attempted: targets.length, failed: targets.filter(a => !a.summaryJa).length };
}

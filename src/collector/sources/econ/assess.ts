import { z } from 'zod';
import {
  RISK_CATEGORIES,
  RiskCategorySchema,
  type EconomicIndicator,
  type NewsArticle,
  type RiskAssessment,
} from '../../../shared/schema/econ';
import { generateStructured, type LlmConfig } from '../../core/llm';
import { scoreToLevel } from './composite';

const LLM_WEIGHT = 0.7;
const MAX_NEWS_IN_PROMPT = 20;
const MAX_SOURCE_NEWS_IDS = 3;
// 4 カテゴリの要約・因子・変化理由で 1.5k 前後。thinking 付きモデルでも途中で切れない余裕を持たせる。
const ASSESS_MAX_OUTPUT_TOKENS = 4096;

const SYSTEM = `あなたはグローバル経済リスクアナリストです。提供データに基づき、4カテゴリのリスクを0-100で評価してください。

カテゴリ: currency_finance(通貨・金融), geopolitics_supply_chain(地政学・供給網), technology(テクノロジー), social_policy(社会・政策)

スコア基準: 0-20:低, 21-40:中程度, 41-60:やや高い, 61-80:高い, 81-100:危機的

summary は日本語2-3文の概要、factors は寄与因子、changeReasonJa は前回比での変化理由を1文で書いてください。
4カテゴリ全て含めてください。sourceNewsIdsはニュースリストの[id:xxx]から最大3件選んでください。

応答形式: {"assessments":[{"category":"technology","score":50,"summary":"...","factors":["..."],"changeReasonJa":"...","sourceNewsIds":["..."]}]}
assessments はカテゴリごとの要素を直接並べた配列にする。items など別の階層を挟まない。`;

// The model is only asked for this loose shape. Each entry is then validated on its own so one
// out-of-range score drops that category (merged from the previous run) instead of failing all four.
const ResponseSchema = z.object({
  assessments: z.array(
    z.object({
      category: z.string(),
      score: z.number(),
      summary: z.string(),
      factors: z.array(z.string()),
      changeReasonJa: z.string().optional(),
      sourceNewsIds: z.array(z.string()).optional(),
    }),
  ),
});

const AssessmentEntrySchema = z.object({
  category: RiskCategorySchema,
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  factors: z.array(z.string()),
  changeReasonJa: z.string().optional(),
  sourceNewsIds: z.array(z.string()).optional(),
});

export function computeQuantSignal(category: string, indicators: readonly EconomicIndicator[]): number | null {
  const get = (code: string) => indicators.find((i) => i.code === code && !i.stale);

  if (category === 'currency_finance') {
    const vix = get('VIX');
    const t10y = get('UST10Y');
    const t3m = get('UST3M');
    let signal = 0;
    let count = 0;
    // round(vix / 60 * 100): 20→33, 30→50, 40→67, 60→100
    if (vix) {
      signal += Math.min(100, Math.round((vix.value / 60) * 100));
      count++;
    }
    if (t10y && t3m) {
      const spread = t10y.value - t3m.value;
      // inverted only: abs(spread) / 3 * 100 → -0.5→17, -2→67, -3→100
      const invertScore = spread < 0 ? Math.min(100, Math.round((Math.abs(spread) / 3) * 100)) : 0;
      signal += invertScore;
      count++;
    }
    return count > 0 ? Math.round(signal / count) : null;
  }

  if (category === 'geopolitics_supply_chain') {
    const wti = get('WTI');
    const gold = get('GOLD');
    let signal = 0;
    let count = 0;
    // WTI/GOLD の急変動 (上昇・下落とも対象): abs(前回比%) / 10 * 100 → 3%→30, 10%以上→100
    const spike = (ind: EconomicIndicator) => {
      if (!ind.previousValue) return 0;
      const pct = Math.abs((ind.value - ind.previousValue) / ind.previousValue) * 100;
      return Math.min(100, Math.round((pct / 10) * 100));
    };
    if (wti) {
      signal += spike(wti);
      count++;
    }
    if (gold) {
      signal += spike(gold);
      count++;
    }
    return count > 0 ? Math.round(signal / count) : null;
  }

  // technology and social_policy: hard to quantify deterministically
  return null;
}

export async function assess(
  news: readonly NewsArticle[],
  indicators: readonly EconomicIndicator[],
  prev: readonly RiskAssessment[],
  config: LlmConfig,
  now: Date,
  opts: { signal?: AbortSignal } = {},
): Promise<RiskAssessment[]> {
  const prevMap = new Map(prev.map((r) => [r.category, r.score]));
  const newsIdSet = new Set(news.map((a) => a.id));

  let ctx = '## 最新ニュース\n';
  for (const a of news.filter((a) => a.summaryJa).slice(0, MAX_NEWS_IN_PROMPT)) {
    ctx += `- [id:${a.id}] [${a.source}] ${a.summaryJa}\n`;
  }
  ctx += '\n## 経済指標\n';
  for (const i of indicators) {
    ctx += `- ${i.name}: ${i.value}${i.unit}${i.previousValue ? ` (前回:${i.previousValue})` : ''}\n`;
  }
  if (prev.length) {
    ctx += '\n## 前回スコア\n';
    for (const r of prev) ctx += `- ${r.category}: ${r.score}\n`;
  }

  const response = await generateStructured(ResponseSchema, ctx, {
    system: SYSTEM,
    config,
    maxOutputTokens: ASSESS_MAX_OUTPUT_TOKENS,
    signal: opts.signal,
  });
  if (!response) throw new Error('LLM is not configured');

  const assessedAt = now.toISOString();
  const validated: RiskAssessment[] = [];
  const seen = new Set<string>();

  for (const item of response.assessments) {
    const result = AssessmentEntrySchema.safeParse(item);
    if (!result.success) {
      console.warn('[assess] Dropping invalid assessment entry:', result.error.issues);
      continue;
    }
    const a = result.data;
    if (seen.has(a.category)) {
      console.warn(`[assess] Dropping duplicate assessment for category: ${a.category}`);
      continue;
    }
    seen.add(a.category);

    const quantSignal = computeQuantSignal(a.category, indicators);
    const finalScore =
      quantSignal !== null ? Math.round(LLM_WEIGHT * a.score + (1 - LLM_WEIGHT) * quantSignal) : a.score;

    const prevScore = prevMap.get(a.category);
    const sourceNewsIds = (a.sourceNewsIds ?? []).filter((id) => newsIdSet.has(id)).slice(0, MAX_SOURCE_NEWS_IDS);

    validated.push({
      category: a.category,
      score: finalScore,
      level: scoreToLevel(finalScore),
      summaryJa: a.summary,
      factorsJa: a.factors,
      assessedAt,
      ...(prevScore !== undefined && { delta: finalScore - prevScore }),
      ...(a.changeReasonJa && { changeReasonJa: a.changeReasonJa }),
      ...(sourceNewsIds.length > 0 && { sourceNewsIds }),
    });
  }

  if (validated.length === 0) throw new Error('LLM assessment returned no valid entries');

  for (const cat of RISK_CATEGORIES) {
    if (!seen.has(cat)) console.warn(`[assess] Missing expected category in LLM response: ${cat}`);
  }

  return validated;
}

// Categories the LLM omitted keep their previous assessment so a partial response cannot erase them.
export function mergeRisks(prev: readonly RiskAssessment[], fresh: readonly RiskAssessment[]): RiskAssessment[] {
  const merged: RiskAssessment[] = [];
  for (const category of RISK_CATEGORIES) {
    const entry = fresh.find((r) => r.category === category) ?? prev.find((r) => r.category === category);
    if (entry) merged.push(entry);
  }
  return merged;
}

import { z } from 'zod';
import { RISK_CATEGORIES, scoreToLevel } from '../../backend/src/schemas/riskConstants.js';
import { callLLM, parseJson } from './llm.js';
import type { EconomicIndicator, NewsArticle, RiskAssessment } from './types.js';

const LLM_WEIGHT = 0.7;

const SYS = `あなたはグローバル経済リスクアナリストです。提供データに基づき、4カテゴリのリスクを0-100で評価してください。

カテゴリ: currency_finance(通貨・金融), geopolitics_supply_chain(地政学・供給網), technology(テクノロジー), social_policy(社会・政策)

スコア基準: 0-20:低, 21-40:中程度, 41-60:やや高い, 61-80:高い, 81-100:危機的

応答は必ず以下のJSON形式:
{"assessments":[{"category":"currency_finance","score":65,"summary":"日本語2-3文の概要","factors":["寄与因子1","寄与因子2","寄与因子3"],"changeReasonJa":"前回比での変化理由を1文で","sourceNewsIds":["id1","id2"]}]}

4カテゴリ全て含めてください。sourceNewsIdsはニュースリストの[id:xxx]から最大3件選んでください。`;

const assessmentSchema = z.object({
  category: z.enum(RISK_CATEGORIES),
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  factors: z.array(z.string()),
  changeReasonJa: z.string().optional(),
  sourceNewsIds: z.array(z.string()).optional(),
});
const responseSchema = z.object({ assessments: z.array(z.unknown()) });

export function computeQuantSignal(category: string, indicators: EconomicIndicator[]): number | null {
  const get = (code: string) => indicators.find(i => i.code === code && !i.stale);

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
      const invertScore = spread < 0 ? Math.min(100, Math.round(Math.abs(spread) / 3 * 100)) : 0;
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
      return Math.min(100, Math.round(pct / 10 * 100));
    };
    if (wti) { signal += spike(wti); count++; }
    if (gold) { signal += spike(gold); count++; }
    return count > 0 ? Math.round(signal / count) : null;
  }

  // technology and social_policy: hard to quantify deterministically
  return null;
}

export async function assess(news: NewsArticle[], indicators: EconomicIndicator[], prev: RiskAssessment[]): Promise<RiskAssessment[]> {
  const prevMap = new Map(prev.map(r => [r.category, r.score]));
  const newsIdSet = new Set(news.map(a => a.id));

  let ctx = '## 最新ニュース\n';
  for (const a of news.filter(a => a.summaryJa).slice(0, 20)) {
    ctx += `- [id:${a.id}] [${a.source}] ${a.summaryJa}\n`;
  }
  ctx += '\n## 経済指標\n';
  for (const i of indicators) ctx += `- ${i.name}: ${i.value}${i.unit}${i.previousValue ? ` (前回:${i.previousValue})` : ''}\n`;
  if (prev.length) { ctx += '\n## 前回スコア\n'; for (const r of prev) ctx += `- ${r.category}: ${r.score}\n`; }

  const raw = await callLLM(SYS, ctx);
  const parsed = parseJson(raw);

  const { assessments: rawItems } = responseSchema.parse(parsed);
  const now = new Date().toISOString();
  const validated: RiskAssessment[] = [];
  const seen = new Set<string>();

  for (const item of rawItems) {
    const result = assessmentSchema.safeParse(item);
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
    const llmScore = a.score;

    const quantSignal = computeQuantSignal(a.category, indicators);
    const finalScore = quantSignal !== null
      ? Math.round(LLM_WEIGHT * llmScore + (1 - LLM_WEIGHT) * quantSignal)
      : llmScore;

    const prevScore = prevMap.get(a.category);
    const delta = prevScore !== undefined ? finalScore - prevScore : undefined;

    const rawIds = a.sourceNewsIds ?? [];
    const sourceNewsIds = rawIds.filter(id => newsIdSet.has(id)).slice(0, 3);

    validated.push({
      category: a.category,
      score: finalScore,
      level: scoreToLevel(finalScore),
      summaryJa: a.summary,
      factorsJa: a.factors,
      assessedAt: now,
      ...(delta !== undefined && { delta }),
      ...(a.changeReasonJa && { changeReasonJa: a.changeReasonJa }),
      ...(sourceNewsIds.length > 0 && { sourceNewsIds }),
    });
  }

  if (validated.length === 0) throw new Error('LLM assessment returned no valid entries');

  for (const cat of RISK_CATEGORIES) {
    if (!seen.has(cat)) {
      console.warn(`[assess] Missing expected category in LLM response: ${cat}`);
    }
  }

  return validated;
}

// Categories the LLM omitted keep their previous assessment so a partial response cannot erase them.
export function mergeRisks(prev: RiskAssessment[], fresh: RiskAssessment[]): RiskAssessment[] {
  const merged: RiskAssessment[] = [];
  for (const category of RISK_CATEGORIES) {
    const entry = fresh.find(r => r.category === category) ?? prev.find(r => r.category === category);
    if (entry) merged.push(entry);
  }
  return merged;
}

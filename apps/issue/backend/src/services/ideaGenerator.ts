import prisma from '../lib/prisma.js';
import { callLLM, parseJsonLLM, type TokenUsage } from './llm.js';
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '../schemas/api.js';

const MAX_ISSUES = 20;
const MIN_APPIFIABILITY_SCORE = 60;

const SYSTEM_PROMPT = `あなたは社会課題を解決するアプリを考えるプロダクトデザイナーです。与えられた社会課題に対して、アプリ/ソフトウェアで解決するアイデアをJSON形式で提案してください。

応答は必ず以下のJSON形式:
{
  "proposedAppIdea": "アプリの概要を1-2文で",
  "mvpFeatures": ["機能1","機能2","機能3"],
  "targetUsers": "主なターゲットユーザーの説明",
  "difficulty": "low|medium|high"
}

difficultyの基準:
- low: 既存技術で6ヶ月以内にMVP可能
- medium: 1年程度、特定の専門知識や連携が必要
- high: 2年以上、または行政連携・大規模インフラが必要`;

interface IdeaResult {
  proposedAppIdea: string;
  mvpFeatures: string[];
  targetUsers: string;
  difficulty: string;
}

function isValidDifficulty(value: string): value is DifficultyLevel {
  return (DIFFICULTY_LEVELS as readonly string[]).includes(value);
}

async function generateIdeaForIssue(issue: {
  id: number;
  originalTitle: string;
  summaryJa: string;
  category: string;
  severityScore: number;
  urgencyScore: number;
  appifiabilityScore: number;
  affectedDomain: string;
}): Promise<{ success: boolean; tokensUsed: number }> {
  const affectedDomains = (() => {
    try {
      return (JSON.parse(issue.affectedDomain) as string[]).join('、');
    } catch {
      return '';
    }
  })();

  const userMessage = `社会課題の情報:
タイトル: ${issue.originalTitle}
概要: ${issue.summaryJa}
カテゴリ: ${issue.category}
深刻度スコア: ${issue.severityScore}/100
緊急度スコア: ${issue.urgencyScore}/100
アプリ化可能性スコア: ${issue.appifiabilityScore}/100
影響領域: ${affectedDomains}

この課題を解決または支援するアプリのアイデアを提案してください。`;

  let result: { text: string; usage: TokenUsage };
  try {
    result = await callLLM(SYSTEM_PROMPT, userMessage);
  } catch (error) {
    console.error(`[IdeaGenerator] LLM call failed for issue ${issue.id}: ${String(error)}`);
    return { success: false, tokensUsed: 0 };
  }

  const rawText = result.text;

  let parsed: IdeaResult;
  try {
    const data = parseJsonLLM(rawText) as IdeaResult;
    if (!data || typeof data.proposedAppIdea !== 'string') {
      throw new Error('Invalid response shape');
    }
    parsed = data;
  } catch (error) {
    console.error(
      `[IdeaGenerator] JSON parse failed for issue ${issue.id}: ${String(error)}\nRaw: ${rawText.slice(0, 300)}`,
    );
    return { success: false, tokensUsed: result.usage.inputTokens + result.usage.outputTokens };
  }

  const difficulty = isValidDifficulty(parsed.difficulty) ? parsed.difficulty : 'medium';
  const mvpFeatures = Array.isArray(parsed.mvpFeatures)
    ? parsed.mvpFeatures.filter((f): f is string => typeof f === 'string')
    : [];

  try {
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        proposedAppIdea: parsed.proposedAppIdea ?? '',
        mvpFeatures: JSON.stringify(mvpFeatures),
        targetUsers: parsed.targetUsers ?? '',
        difficulty,
        ideaGeneratedAt: new Date(),
      },
    });
    return { success: true, tokensUsed: result.usage.inputTokens + result.usage.outputTokens };
  } catch (error) {
    console.error(`[IdeaGenerator] DB update failed for issue ${issue.id}: ${String(error)}`);
    return { success: false, tokensUsed: result.usage.inputTokens + result.usage.outputTokens };
  }
}

export async function generateIdeas(): Promise<{ generated: number; tokensUsed: number }> {
  console.log('[IdeaGenerator] Starting idea generation...');

  const candidates = await prisma.issue.findMany({
    where: {
      appifiabilityScore: { gte: MIN_APPIFIABILITY_SCORE },
      ideaGeneratedAt: null,
      classifiedAt: { not: null },
    },
    select: {
      id: true,
      originalTitle: true,
      summaryJa: true,
      category: true,
      severityScore: true,
      urgencyScore: true,
      appifiabilityScore: true,
      affectedDomain: true,
    },
    orderBy: { appifiabilityScore: 'desc' },
    take: MAX_ISSUES,
  });

  if (candidates.length === 0) {
    console.log('[IdeaGenerator] No eligible issues for idea generation.');
    return { generated: 0, tokensUsed: 0 };
  }

  console.log(`[IdeaGenerator] Found ${candidates.length} candidates.`);
  let generated = 0;
  let totalTokens = 0;

  const INTER_REQUEST_DELAY_MS = 3000;

  for (let i = 0; i < candidates.length; i++) {
    const issue = candidates[i];
    console.log(`[IdeaGenerator] Generating idea for issue ${issue.id} (${i + 1}/${candidates.length}): ${issue.originalTitle.slice(0, 60)}`);
    const { success, tokensUsed: ideaTokens } = await generateIdeaForIssue(issue);
    if (success) generated++;
    totalTokens += ideaTokens;
    // Pacing: avoid rate limiting on LLM APIs (except after the last issue)
    if (i < candidates.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
    }
  }

  console.log(`[IdeaGenerator] Done. generated=${generated}, tokens=${totalTokens}`);

  return { generated, tokensUsed: totalTokens };
}

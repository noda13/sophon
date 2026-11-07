import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { scoreToLevel, RISK_WEIGHTS, riskCategorySchema } from '../schemas/api.js';
import type { RiskCategory } from '../schemas/api.js';

const router: Router = Router();

/** Look up a weight by Prisma's string category field without widening RISK_WEIGHTS. */
const weightFor = (category: string): number =>
  RISK_WEIGHTS[category as RiskCategory] ?? 0;

async function getLatestAssessments() {
  const latest = await Promise.all(
    riskCategorySchema.options.map((category) =>
      prisma.riskAssessment.findFirst({
        where: { category },
        orderBy: { assessedAt: 'desc' },
      })
    )
  );
  return latest.filter((risk) => risk !== null);
}

// GET /api/risks - Get latest risk assessments for all categories
router.get('/', asyncHandler(async (_req, res) => {
  res.json(await getLatestAssessments());
}));

// GET /api/risks/composite - Get composite (weighted average) risk index
router.get('/composite', asyncHandler(async (_req, res) => {
  const risks = await getLatestAssessments();
  if (risks.length === 0) {
    res.json({ compositeScore: 0, level: 'low', breakdown: [] });
    return;
  }

  // Only sum weights for categories that actually have data so the index is
  // not biased downward when some categories are absent.
  const totalWeight = risks.reduce((s, r) => s + weightFor(r.category), 0);
  if (totalWeight === 0) {
    res.json({ compositeScore: 0, level: 'low', breakdown: [] });
    return;
  }

  const compositeScore = Math.round(
    risks.reduce((sum, risk) => sum + (risk.score * weightFor(risk.category)), 0) / totalWeight
  );

  const level = scoreToLevel(compositeScore);

  res.json({
    compositeScore,
    level,
    breakdown: risks.map((r) => ({
      category: r.category,
      score: r.score,
      weight: weightFor(r.category),
    })),
  });
}));

// GET /api/risks/:category - Get risk history for a category
router.get('/:category', asyncHandler(async (req, res) => {
  const parsed = riskCategorySchema.safeParse(req.params.category);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }
  const category = parsed.data;

  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const history = await prisma.riskAssessment.findMany({
    where: {
      category,
      assessedAt: { gte: since },
    },
    orderBy: { assessedAt: 'asc' },
  });

  res.json(history);
}));

export default router;

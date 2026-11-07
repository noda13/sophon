import { Router, type Router as RouterType, type Request, type Response } from 'express';
import prisma from '../lib/prisma.js';
import { ISSUE_CATEGORIES, DIFFICULTY_LEVELS, type IssueCategoryType, type DifficultyLevel, ideaQuerySchema } from '../schemas/api.js';

const router: RouterType = Router();

const MIN_APPIFIABILITY_SCORE = 60;

// GET /api/ideas
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = ideaQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.format() });
      return;
    }

    const { limit, offset, category, difficulty } = parsed.data;

    type WhereClause = {
      appifiabilityScore: { gte: number };
      ideaGeneratedAt: { not: null };
      category?: string;
      difficulty?: string;
    };

    const where: WhereClause = {
      appifiabilityScore: { gte: MIN_APPIFIABILITY_SCORE },
      ideaGeneratedAt: { not: null },
    };

    if (typeof category === 'string' && (ISSUE_CATEGORIES as readonly string[]).includes(category)) {
      where.category = category as IssueCategoryType;
    }

    if (typeof difficulty === 'string' && (DIFFICULTY_LEVELS as readonly string[]).includes(difficulty)) {
      where.difficulty = difficulty as DifficultyLevel;
    }

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: { appifiabilityScore: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.issue.count({ where }),
    ]);

    res.json({ issues, total, limit, offset });
  } catch (error) {
    console.error('[Ideas]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/ideas/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const issue = await prisma.issue.findUnique({ where: { id } });
    if (!issue) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    if (!issue.ideaGeneratedAt) {
      res.status(404).json({ error: 'No app idea generated for this issue' });
      return;
    }

    res.json({ issue });
  } catch (error) {
    console.error('[Ideas]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

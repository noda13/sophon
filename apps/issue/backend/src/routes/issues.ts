import { Router, type Router as RouterType, type Request, type Response } from 'express';
import prisma from '../lib/prisma.js';
import { ISSUE_CATEGORIES, type IssueCategoryType, issueQuerySchema } from '../schemas/api.js';

const VALID_SOURCE_TYPES = ['news_jp', 'news_global', 'gov', 'twitter'] as const;

const router: RouterType = Router();

// GET /api/issues
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = issueQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.format() });
      return;
    }

    const { limit, offset, category, sourceType, minSeverity } = parsed.data;

    type WhereClause = {
      category?: string;
      sourceType?: string;
      severityScore?: { gte: number };
    };

    const where: WhereClause = {};

    if (typeof category === 'string' && (ISSUE_CATEGORIES as readonly string[]).includes(category)) {
      where.category = category as IssueCategoryType;
    }

    if (typeof sourceType === 'string' && (VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      where.sourceType = sourceType;
    }

    if (minSeverity !== undefined) {
      where.severityScore = { gte: minSeverity };
    }

    const [issues, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.issue.count({ where }),
    ]);

    res.json({ issues, total, limit, offset });
  } catch (error) {
    console.error('[Issues]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/issues/:id
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

    res.json({ issue });
  } catch (error) {
    console.error('[Issues]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

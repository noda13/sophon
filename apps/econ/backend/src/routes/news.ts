import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { riskCategorySchema } from '../schemas/api.js';

const router: Router = Router();

// GET /api/news - Get latest news articles
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const rawCategory = req.query.category as string | undefined;

  // Validate the category against the allowed enum before using it in a query.
  // Note: { contains } is a substring match on the serialized riskCategories
  // field; a proper fix requires a schema change (join table) and is deferred.
  let where = {};
  if (rawCategory !== undefined) {
    const parsed = riskCategorySchema.safeParse(rawCategory);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid category' });
      return;
    }
    where = { riskCategories: { contains: parsed.data } };
  }

  const articles = await prisma.newsArticle.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      sourceId: true,
      source: true,
      originalTitle: true,
      originalUrl: true,
      publishedAt: true,
      summaryJa: true,
      relevanceScore: true,
      riskCategories: true,
      createdAt: true,
    },
  });

  res.json(articles);
}));

export default router;

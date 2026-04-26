import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { getStockStrategyScores } from '../services/screener.js';

const router: RouterType = Router();

const codeSchema = z.string().regex(/^\d{4}$/, 'Stock code must be a 4-digit number');

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  maxMarketCap: z.coerce.number().positive().optional(),
  sector: z.string().optional(),
  orderBy: z.enum(['code', 'name', 'marketCap']).optional().default('code'),
});

router.get('/', async (req, res) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { limit, sector } = parsed.data;
    const stocks = await prisma.stock.findMany({
      where: sector ? { sector33Name: { contains: sector } } : undefined,
      take: limit,
      orderBy: { code: 'asc' },
      include: {
        snapshots: {
          orderBy: { snapshotAt: 'desc' },
          take: 1,
        },
      },
    });
    res.json(stocks);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const parsed = codeSchema.safeParse(req.params.code);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const code = parsed.data;
    const stock = await prisma.stock.findUnique({
      where: { code },
      include: {
        snapshots: {
          orderBy: { snapshotAt: 'desc' },
          take: 1,
        },
        statements: {
          orderBy: { disclosedDate: 'desc' },
          take: 8,
        },
      },
    });
    if (!stock) {
      res.status(404).json({ error: `Stock ${code} not found` });
      return;
    }
    res.json(stock);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/stocks/:code/history — up to 8 most recent financial statements
router.get('/:code/history', async (req, res) => {
  try {
    const parsed = codeSchema.safeParse(req.params.code);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const code = parsed.data;
    const stock = await prisma.stock.findUnique({ where: { code } });
    if (!stock) {
      res.status(404).json({ error: `Stock ${code} not found` });
      return;
    }
    const statements = await prisma.financialStatement.findMany({
      where: { code },
      orderBy: { disclosedDate: 'desc' },
      take: 8,
    });
    res.json(statements);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/stocks/:code/strategies — all active strategy scores for this stock
router.get('/:code/strategies', async (req, res) => {
  try {
    const parsed = codeSchema.safeParse(req.params.code);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const code = parsed.data;
    const scores = await getStockStrategyScores(code);
    res.json(scores);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

export default router;

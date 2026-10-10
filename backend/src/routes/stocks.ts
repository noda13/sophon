import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { getStockStrategyScores } from '../services/screener.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../lib/errors.js';

const router: RouterType = Router();

const codeSchema = z.string().regex(/^[0-9A-Z]{4}$/, 'Stock code must be a 4-character alphanumeric code');

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  maxMarketCap: z.coerce.number().positive().optional(),
  sector: z.string().optional(),
  orderBy: z.enum(['code', 'name', 'marketCap']).optional().default('code'),
});

function parseCode(raw: string): string {
  const parsed = codeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.message);
  }
  return parsed.data;
}

router.get('/', asyncHandler(async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.message);
  }
  const { limit, sector, orderBy } = parsed.data;
  const prismaOrderBy: Prisma.StockOrderByWithRelationInput =
    orderBy === 'name' ? { name: 'asc' } : { code: 'asc' };
  const stocks = await prisma.stock.findMany({
    where: sector ? { sector33Name: { contains: sector } } : undefined,
    take: orderBy === 'marketCap' ? undefined : limit,
    orderBy: prismaOrderBy,
    include: {
      snapshots: {
        orderBy: { snapshotAt: 'desc' },
        take: 1,
      },
    },
  });
  if (orderBy === 'marketCap') {
    stocks.sort(
      (a, b) =>
        ((b.snapshots[0]?.marketCap ?? 0) as number) -
        ((a.snapshots[0]?.marketCap ?? 0) as number),
    );
    stocks.splice(limit);
  }
  res.json(stocks);
}));

router.get('/:code', asyncHandler(async (req, res) => {
  const code = parseCode(req.params.code);
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
    throw new NotFoundError(`Stock ${code} not found`);
  }
  res.json(stock);
}));

// GET /api/stocks/:code/history — up to 8 most recent financial statements
router.get('/:code/history', asyncHandler(async (req, res) => {
  const code = parseCode(req.params.code);
  const stock = await prisma.stock.findUnique({ where: { code } });
  if (!stock) {
    throw new NotFoundError(`Stock ${code} not found`);
  }
  const statements = await prisma.financialStatement.findMany({
    where: { code },
    orderBy: { disclosedDate: 'desc' },
    take: 8,
  });
  res.json(statements);
}));

// GET /api/stocks/:code/strategies — all active strategy scores for this stock
router.get('/:code/strategies', asyncHandler(async (req, res) => {
  const code = parseCode(req.params.code);
  const scores = await getStockStrategyScores(code);
  res.json(scores);
}));

export default router;

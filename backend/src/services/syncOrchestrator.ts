import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';
import { resolveProvider } from '../providers/index.js';
import type { DataProvider } from '../providers/DataProvider.js';
import { computeMarketCap, computeMetrics } from './metricCalculator.js';

export async function runSync(opts?: { provider?: DataProvider }): Promise<{ stocks: number; snapshots: number }> {
  const provider = opts?.provider ?? resolveProvider();

  const log = await prisma.collectionLog.create({
    data: {
      jobType: 'full',
      status: 'running',
      startedAt: new Date(),
    },
  });

  let stocksProcessed = 0;
  let snapshotsCreated = 0;

  try {
    const stockList = await provider.listStocks();
    const limited = stockList.slice(0, config.mvpStockLimit);

    for (const info of limited) {
      // Upsert stock
      await prisma.stock.upsert({
        where: { code: info.code },
        update: {
          name: info.name,
          sector33Name: info.sector33Name ?? null,
          marketSegment: info.marketSegment ?? null,
        },
        create: {
          code: info.code,
          name: info.name,
          sector33Name: info.sector33Name ?? null,
          sector33Code: info.sector33Code ?? null,
          sector17Code: info.sector17Code ?? null,
          marketSegment: info.marketSegment ?? null,
          scaleCategory: info.scaleCategory ?? null,
        },
      });

      // Upsert financial statements
      const statements = await provider.fetchStatements(info.code);
      for (const stmt of statements) {
        await prisma.financialStatement.upsert({
          where: {
            code_fiscalYear_typeOfCurrentPeriod: {
              code: stmt.code,
              fiscalYear: stmt.fiscalYear,
              typeOfCurrentPeriod: stmt.typeOfCurrentPeriod,
            },
          },
          update: {
            netSales: stmt.netSales ?? null,
            operatingProfit: stmt.operatingProfit ?? null,
            profit: stmt.profit ?? null,
            totalAssets: stmt.totalAssets ?? null,
            equity: stmt.equity ?? null,
            cashAndEquivalents: stmt.cashAndEquivalents ?? null,
            sharesOutstanding: stmt.sharesOutstanding ?? null,
          },
          create: {
            code: stmt.code,
            fiscalYear: stmt.fiscalYear,
            typeOfCurrentPeriod: stmt.typeOfCurrentPeriod,
            disclosedDate: stmt.disclosedDate,
            periodEndDate: stmt.periodEndDate,
            netSales: stmt.netSales ?? null,
            operatingProfit: stmt.operatingProfit ?? null,
            profit: stmt.profit ?? null,
            totalAssets: stmt.totalAssets ?? null,
            equity: stmt.equity ?? null,
            cashAndEquivalents: stmt.cashAndEquivalents ?? null,
            sharesOutstanding: stmt.sharesOutstanding ?? null,
          },
        });
      }

      // Upsert prices
      const prices = await provider.fetchPrices(info.code);
      for (const price of prices) {
        await prisma.dailyPrice.upsert({
          where: {
            code_date: {
              code: price.code,
              date: price.date,
            },
          },
          update: { close: price.close },
          create: {
            code: price.code,
            date: price.date,
            close: price.close,
          },
        });
      }

      // Get latest statement and price
      const latestStmt = await prisma.financialStatement.findFirst({
        where: { code: info.code },
        orderBy: { disclosedDate: 'desc' },
      });
      const latestPrice = await prisma.dailyPrice.findFirst({
        where: { code: info.code },
        orderBy: { date: 'desc' },
      });

      if (!latestStmt || !latestPrice) continue;

      const shares = latestStmt.sharesOutstanding ?? info.sharesOutstanding;
      const marketCap = computeMarketCap(shares, latestPrice.close);

      const metrics = computeMetrics({
        marketCap,
        cashAndEquivalents: latestStmt.cashAndEquivalents,
        totalAssets: latestStmt.totalAssets,
        equity: latestStmt.equity,
        investmentSecurities: null,
        profit: latestStmt.profit,
      });

      await prisma.screeningSnapshot.create({
        data: {
          code: info.code,
          snapshotAt: new Date(),
          marketCap,
          netCash: metrics.netCash,
          netCashRatio: metrics.netCashRatio,
          cashNeutralPer: metrics.cashNeutralPer,
          per: metrics.per,
          pbr: metrics.pbr,
        },
      });
      snapshotsCreated++;
      stocksProcessed++;
    }

    await prisma.collectionLog.update({
      where: { id: log.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsProcessed: stocksProcessed,
      },
    });

    return { stocks: stocksProcessed, snapshots: snapshotsCreated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.collectionLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        message,
      },
    });
    throw err;
  }
}

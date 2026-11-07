import prisma from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import { resolveProvider } from '../providers/index.js';
import type { DataProvider } from '../providers/DataProvider.js';
import { invalidateScreenerCache } from './screener.js';
import { computeMarketCap, computeMetrics } from './metricCalculator.js';

let _syncInProgress = false;

export function isSyncing(): boolean {
  return _syncInProgress;
}

export async function runSync(opts?: { provider?: DataProvider }): Promise<{ stocks: number; snapshots: number }> {
  _syncInProgress = true;
  logger.info('[sync] starting runSync...');
  let logId: string | null = null;
  let stocksProcessed = 0;
  let snapshotsCreated = 0;

  try {
    const provider = opts?.provider ?? resolveProvider();
    const log = await prisma.collectionLog.create({
      data: {
        jobType: 'full',
        status: 'running',
        startedAt: new Date(),
      },
    });
    logId = log.id;

    // If provider supports batch prefetch (e.g., JQuantsProvider V2),
    // use it to minimize per-code API calls.
    if (provider.prefetchAll) {
      logger.info('[sync] prefetching bulk data via batch endpoints...');
      const pre = await provider.prefetchAll({ historyDays: 120 });
      logger.info(
        `[sync] prefetch done: ${pre.statementsCached} statements, ${pre.pricesCached} prices, ${pre.apiCalls} API calls`
      );
    }

    const stockList = await provider.listStocks();

    // Filter out ETFs / REITs / other funds (sector33Code = '9999' / 'その他')
    // — these don't have meaningful NetCash calculations for 清原流 screening
    const ordinaryStocks = stockList.filter((s) => {
      const code = s.sector33Code;
      const name = s.sector33Name;
      return code !== '9999' && name !== 'その他';
    });

    // Cap at MVP_STOCK_LIMIT for fast iteration / smoke testing.
    // Set to a large number (e.g. 10000) in .env to process all listed stocks.
    const limited =
      config.mvpStockLimit > 0 && ordinaryStocks.length > config.mvpStockLimit
        ? ordinaryStocks.slice(0, config.mvpStockLimit)
        : ordinaryStocks;

    logger.info(
      `[sync] total=${stockList.length}, ordinary=${ordinaryStocks.length}, processing=${limited.length} (MVP_STOCK_LIMIT=${config.mvpStockLimit})`
    );

    for (const [idx, info] of limited.entries()) {
      if ((idx + 1) % 10 === 0 || idx === limited.length - 1) {
        logger.info(`[sync] ${idx + 1}/${limited.length} (${info.code} ${info.name})`);
      }
      const statements = await provider.fetchStatements(info.code);
      const prices = await provider.fetchPrices(info.code);

      // One transaction per stock: a single fsync instead of one per row
      await prisma.$transaction([
        prisma.stock.upsert({
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
        }),
        ...statements.map(stmt => {
          const fields = {
            netSales: stmt.netSales ?? null,
            operatingProfit: stmt.operatingProfit ?? null,
            ordinaryProfit: stmt.ordinaryProfit ?? null,
            profit: stmt.profit ?? null,
            totalAssets: stmt.totalAssets ?? null,
            equity: stmt.equity ?? null,
            currentAssets: stmt.currentAssets ?? null,
            cashAndEquivalents: stmt.cashAndEquivalents ?? null,
            sharesOutstanding: stmt.sharesOutstanding ?? null,
          };
          return prisma.financialStatement.upsert({
            where: {
              code_fiscalYear_typeOfCurrentPeriod: {
                code: stmt.code,
                fiscalYear: stmt.fiscalYear,
                typeOfCurrentPeriod: stmt.typeOfCurrentPeriod,
              },
            },
            update: fields,
            create: {
              code: stmt.code,
              fiscalYear: stmt.fiscalYear,
              typeOfCurrentPeriod: stmt.typeOfCurrentPeriod,
              disclosedDate: stmt.disclosedDate,
              periodEndDate: stmt.periodEndDate,
              ...fields,
            },
          });
        }),
        ...prices.map(price =>
          prisma.dailyPrice.upsert({
            where: { code_date: { code: price.code, date: price.date } },
            update: { close: price.close },
            create: { code: price.code, date: price.date, close: price.close },
          })
        ),
      ]);

      // Get latest statement and price
      const recentStmts = await prisma.financialStatement.findMany({
        where: { code: info.code },
        orderBy: { disclosedDate: 'desc' },
        take: 10,
      });
      // Prefer FY (annual) for balance sheet metrics; quarterly reports often lack currentAssets
      const latestStmt = recentStmts.find(s => s.typeOfCurrentPeriod === 'FY') ?? recentStmts[0] ?? null;
      const latestPrice = await prisma.dailyPrice.findFirst({
        where: { code: info.code },
        orderBy: { date: 'desc' },
      });

      if (!latestStmt || !latestPrice) continue;

      const shares = latestStmt.sharesOutstanding ?? info.sharesOutstanding;
      const marketCap = computeMarketCap(shares, latestPrice.close);

      const metrics = computeMetrics({
        marketCap,
        currentAssets: latestStmt.currentAssets,
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

    const cutoff = new Date(Date.now() - 30 * 24 * 3_600_000);
    await prisma.screeningSnapshot.deleteMany({
      where: { snapshotAt: { lt: cutoff } },
    });

    await prisma.collectionLog.update({
      where: { id: logId },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsProcessed: stocksProcessed,
      },
    });

    return { stocks: stocksProcessed, snapshots: snapshotsCreated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logId) {
      await prisma.collectionLog.update({
        where: { id: logId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          message,
        },
      });
    }
    throw err;
  } finally {
    invalidateScreenerCache();
    _syncInProgress = false;
  }
}

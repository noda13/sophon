import prisma from '../lib/prisma.js';
import { config } from '../lib/config.js';
import { resolveProvider } from '../providers/index.js';
import type { DataProvider } from '../providers/DataProvider.js';
import { computeMarketCap, computeMetrics } from './metricCalculator.js';

let _syncInProgress = false;

export function isSyncing(): boolean {
  return _syncInProgress;
}

export async function runSync(opts?: { provider?: DataProvider }): Promise<{ stocks: number; snapshots: number }> {
  _syncInProgress = true;
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
    // If provider supports batch prefetch (e.g., JQuantsProvider V2),
    // use it to minimize per-code API calls.
    if (provider.prefetchAll) {
      console.log('[sync] prefetching bulk data via batch endpoints...');
      const pre = await provider.prefetchAll({ historyDays: 120 });
      console.log(
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

    console.log(
      `[sync] total=${stockList.length}, ordinary=${ordinaryStocks.length}, processing=${limited.length} (MVP_STOCK_LIMIT=${config.mvpStockLimit})`
    );

    for (const [idx, info] of limited.entries()) {
      if ((idx + 1) % 10 === 0 || idx === limited.length - 1) {
        console.log(`[sync] ${idx + 1}/${limited.length} (${info.code} ${info.name})`);
      }
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
            currentAssets: stmt.currentAssets ?? null,
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
            currentAssets: stmt.currentAssets ?? null,
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
  } finally {
    _syncInProgress = false;
  }
}

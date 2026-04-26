import type { DataProvider, StockInfo, StatementRaw, PriceRaw } from './DataProvider.js';
import prisma from '../lib/prisma.js';

/**
 * DbProvider — reads already-synced data directly from SQLite via Prisma.
 * Use DATA_PROVIDER=db to export real J-Quants data to static JSON for GitHub Pages.
 * Requires a prior full sync (DATA_PROVIDER=jquants + /api/admin/sync).
 */
export class DbProvider implements DataProvider {
  name = 'db';

  // In-memory caches populated by prefetchAll()
  private _statementCache = new Map<string, StatementRaw[]>();
  private _priceCache = new Map<string, PriceRaw[]>();
  private _prefetched = false;

  async listStocks(): Promise<StockInfo[]> {
    const stocks = await prisma.stock.findMany({
      select: {
        code: true,
        name: true,
        sector33Code: true,
        sector33Name: true,
        sector17Code: true,
        marketSegment: true,
        scaleCategory: true,
      },
    });

    // Get latest sharesOutstanding per code via a separate query
    const latestStmts = await prisma.financialStatement.findMany({
      orderBy: { disclosedDate: 'desc' },
      distinct: ['code'],
      select: { code: true, sharesOutstanding: true },
    });
    const sharesMap = new Map(latestStmts.map(s => [s.code, s.sharesOutstanding ?? 0]));

    return stocks.map(s => ({
      code: s.code,
      name: s.name,
      sector33Code: s.sector33Code ?? undefined,
      sector33Name: s.sector33Name ?? undefined,
      sector17Code: s.sector17Code ?? undefined,
      marketSegment: s.marketSegment ?? undefined,
      scaleCategory: s.scaleCategory ?? undefined,
      sharesOutstanding: sharesMap.get(s.code) ?? 0,
    }));
  }

  async fetchStatements(code: string, opts?: { limit?: number }): Promise<StatementRaw[]> {
    if (this._prefetched) {
      return this._statementCache.get(code) ?? [];
    }

    const limit = opts?.limit ?? 8;
    const rows = await prisma.financialStatement.findMany({
      where: { code },
      orderBy: { disclosedDate: 'desc' },
      take: limit,
    });

    return rows.map(r => ({
      code: r.code,
      fiscalYear: r.fiscalYear,
      typeOfCurrentPeriod: r.typeOfCurrentPeriod,
      disclosedDate: r.disclosedDate,
      periodEndDate: r.periodEndDate,
      netSales: r.netSales,
      operatingProfit: r.operatingProfit,
      ordinaryProfit: r.ordinaryProfit,
      profit: r.profit,
      totalAssets: r.totalAssets,
      equity: r.equity,
      currentAssets: r.currentAssets,
      cashAndEquivalents: r.cashAndEquivalents,
      sharesOutstanding: r.sharesOutstanding,
    }));
  }

  async fetchPrices(code: string, opts?: { from?: Date; to?: Date }): Promise<PriceRaw[]> {
    if (this._prefetched) {
      return this._priceCache.get(code) ?? [];
    }

    const rows = await prisma.dailyPrice.findMany({
      where: {
        code,
        ...(opts?.from ? { date: { gte: opts.from } } : {}),
        ...(opts?.to ? { date: { lte: opts.to } } : {}),
      },
      orderBy: { date: 'desc' },
      take: 30,
    });

    return rows.map(r => ({ code: r.code, date: r.date, close: r.close }));
  }

  async prefetchAll(): Promise<{ statementsCached: number; pricesCached: number; apiCalls: number }> {
    console.log('  DbProvider.prefetchAll: loading all statements from DB...');
    const stmts = await prisma.financialStatement.findMany({
      orderBy: { disclosedDate: 'desc' },
    });

    for (const r of stmts) {
      const entry: StatementRaw = {
        code: r.code,
        fiscalYear: r.fiscalYear,
        typeOfCurrentPeriod: r.typeOfCurrentPeriod,
        disclosedDate: r.disclosedDate,
        periodEndDate: r.periodEndDate,
        netSales: r.netSales,
        operatingProfit: r.operatingProfit,
        ordinaryProfit: r.ordinaryProfit,
        profit: r.profit,
        totalAssets: r.totalAssets,
        equity: r.equity,
        currentAssets: r.currentAssets,
        cashAndEquivalents: r.cashAndEquivalents,
        sharesOutstanding: r.sharesOutstanding,
      };
      const arr = this._statementCache.get(r.code) ?? [];
      arr.push(entry);
      this._statementCache.set(r.code, arr);
    }

    console.log('  DbProvider.prefetchAll: loading all prices from DB...');
    const prices = await prisma.dailyPrice.findMany({
      orderBy: { date: 'desc' },
    });

    for (const r of prices) {
      const entry: PriceRaw = { code: r.code, date: r.date, close: r.close };
      const arr = this._priceCache.get(r.code) ?? [];
      arr.push(entry);
      this._priceCache.set(r.code, arr);
    }

    this._prefetched = true;
    console.log(`  DbProvider.prefetchAll: cached ${this._statementCache.size} statement groups, ${this._priceCache.size} price groups`);
    return {
      statementsCached: stmts.length,
      pricesCached: prices.length,
      apiCalls: 0,
    };
  }
}

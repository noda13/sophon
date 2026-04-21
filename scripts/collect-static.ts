/**
 * collect-static.ts
 *
 * Generates static JSON files for GitHub Pages deployment.
 * Works with CsvProvider (DATA_PROVIDER=csv) — no J-Quants registration needed.
 *
 * Usage:
 *   DATA_PROVIDER=csv pnpm exec tsx scripts/collect-static.ts
 *
 * Output: frontend/public/data/
 *   - meta.json
 *   - strategies.json
 *   - ranking-{id}.json  (one per active strategy)
 *   - stocks.json        (all StockMetrics)
 *   - stock-{code}.json  (per-stock detail)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Manual .env loader (no dotenv dependency at root level)
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

// Load env from backend/.env or root .env (env vars already set in shell take priority)
loadEnvFile(resolve(__dirname, '..', 'backend', '.env'));
loadEnvFile(resolve(__dirname, '..', '.env'));

// Import backend modules
import { resolveProvider } from '../backend/src/providers/index.js';
import { strategies, activeStrategies } from '../backend/src/strategies/index.js';
import { computeMarketCap, computeMetrics } from '../backend/src/services/metricCalculator.js';
import type { StockMetrics } from '../backend/src/strategies/InvestmentStrategy.js';

const OUT_DIR = resolve(__dirname, '..', 'frontend', 'public', 'data');

function write(filename: string, data: unknown): void {
  const path = resolve(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  wrote ${filename}`);
}

async function main() {
  console.log('collect-static: starting...');
  mkdirSync(OUT_DIR, { recursive: true });

  const provider = resolveProvider();
  console.log(`  provider: ${provider.name}`);

  // 1. List stocks
  const stockInfos = await provider.listStocks();
  console.log(`  found ${stockInfos.length} stocks`);

  // 2. Build StockMetrics for all stocks
  const allMetrics: StockMetrics[] = [];

  for (const info of stockInfos) {
    const statements = await provider.fetchStatements(info.code);
    const prices = await provider.fetchPrices(info.code);

    if (statements.length === 0 || prices.length === 0) continue;

    // Use the most recent statement and price
    const latestStmt = statements.sort(
      (a, b) => new Date(b.disclosedDate).getTime() - new Date(a.disclosedDate).getTime()
    )[0];
    const latestPrice = prices.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    const shares = latestStmt.sharesOutstanding ?? info.sharesOutstanding;
    const marketCap = computeMarketCap(shares, latestPrice.close);

    const metrics = computeMetrics({
      marketCap,
      cashAndEquivalents: latestStmt.cashAndEquivalents ?? null,
      totalAssets: latestStmt.totalAssets ?? null,
      equity: latestStmt.equity ?? null,
      investmentSecurities: null,
      profit: latestStmt.profit ?? null,
    });

    allMetrics.push({
      code: info.code,
      name: info.name,
      sector33Name: info.sector33Name ?? null,
      marketSegment: info.marketSegment ?? null,
      marketCap,
      netCash: metrics.netCash,
      netCashRatio: metrics.netCashRatio,
      cashNeutralPer: metrics.cashNeutralPer,
      per: metrics.per,
      pbr: metrics.pbr,
      profit: latestStmt.profit ?? null,
      equity: latestStmt.equity ?? null,
    });
  }

  // 3. Write strategies.json
  write('strategies.json', strategies.map(s => s.meta));

  // 4. Write ranking-{id}.json for each active strategy
  for (const strategy of activeStrategies()) {
    const rows = strategy.rank(allMetrics, { limit: 200 });
    write(`ranking-${strategy.meta.id}.json`, rows);
  }

  // 5. Write stocks.json (all metrics)
  write('stocks.json', allMetrics);

  // 6. Write stock-{code}.json for each stock
  for (const info of stockInfos) {
    const statements = await provider.fetchStatements(info.code);

    // Sort statements newest first for history
    const history = statements
      .sort((a, b) => new Date(b.disclosedDate).getTime() - new Date(a.disclosedDate).getTime())
      .slice(0, 8);

    // Find metrics for this stock
    const m = allMetrics.find(x => x.code === info.code);

    // Strategy scores
    const scoreMap: Record<string, unknown> = {};
    if (m) {
      for (const strategy of activeStrategies()) {
        scoreMap[strategy.meta.id] = strategy.score(m);
      }
    }

    // Build a minimal profile (matches StockProfile shape)
    const latestStmt = history[0] ?? null;
    const prices = await provider.fetchPrices(info.code);
    const latestPrice = prices.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    const shares = latestStmt?.sharesOutstanding ?? info.sharesOutstanding;
    const marketCap = latestPrice ? computeMarketCap(shares, latestPrice.close) : 0;
    const metricsForSnapshot = latestStmt
      ? computeMetrics({
          marketCap,
          cashAndEquivalents: latestStmt.cashAndEquivalents ?? null,
          totalAssets: latestStmt.totalAssets ?? null,
          equity: latestStmt.equity ?? null,
          investmentSecurities: null,
          profit: latestStmt.profit ?? null,
        })
      : null;

    const detail = {
      profile: {
        code: info.code,
        name: info.name,
        sector33Name: info.sector33Name ?? null,
        sector33Code: info.sector33Code ?? null,
        sector17Code: info.sector17Code ?? null,
        marketSegment: info.marketSegment ?? null,
        scaleCategory: info.scaleCategory ?? null,
        updatedAt: new Date().toISOString(),
        snapshots: metricsForSnapshot
          ? [
              {
                id: `static-${info.code}`,
                snapshotAt: new Date().toISOString(),
                marketCap,
                netCash: metricsForSnapshot.netCash,
                netCashRatio: metricsForSnapshot.netCashRatio,
                cashNeutralPer: metricsForSnapshot.cashNeutralPer,
                per: metricsForSnapshot.per,
                pbr: metricsForSnapshot.pbr,
              },
            ]
          : [],
      },
      history: history.map(s => ({
        id: `static-${info.code}-${s.fiscalYear}-${s.typeOfCurrentPeriod}`,
        code: s.code,
        fiscalYear: s.fiscalYear,
        typeOfCurrentPeriod: s.typeOfCurrentPeriod,
        disclosedDate: s.disclosedDate instanceof Date ? s.disclosedDate.toISOString() : s.disclosedDate,
        periodEndDate: s.periodEndDate instanceof Date ? s.periodEndDate.toISOString() : s.periodEndDate,
        netSales: s.netSales ?? null,
        operatingProfit: s.operatingProfit ?? null,
        ordinaryProfit: null,
        profit: s.profit ?? null,
        totalAssets: s.totalAssets ?? null,
        equity: s.equity ?? null,
        cashAndEquivalents: s.cashAndEquivalents ?? null,
        sharesOutstanding: s.sharesOutstanding ?? null,
      })),
      strategies: scoreMap,
    };

    write(`stock-${info.code}.json`, detail);
  }

  // 7. Write meta.json
  write('meta.json', {
    generatedAt: new Date().toISOString(),
    provider: provider.name,
    stockCount: allMetrics.length,
  });

  console.log(`\ncollect-static: done. ${allMetrics.length} stocks, ${activeStrategies().length} active strategies.`);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch(err => {
  console.error('collect-static failed:', err);
  process.exit(1);
});

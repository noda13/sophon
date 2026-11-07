import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  RankingFileSchema,
  StockDetailSchema,
  StocksFileSchema,
  StrategiesFileSchema,
  type StockMetrics,
  type StrategyScore,
} from '../../../shared/schema/stock';
import type { CollectorSource, RunContext, RunResult } from '../../core/source';
import { jsonFile, writeJsonBatch, type JsonFile } from '../../core/io';
import { createJQuantsClient, fetchMarketData } from './jquants';
import { buildStockDetail, buildStockMetrics } from './metrics';
import { activeStrategies, strategies } from './strategies';

const RANKING_LIMIT = 200;
const DETAIL_DIR = 'stocks';
// Codes become file names, so anything outside J-Quants' 4-character alphanumeric form is dropped.
const CODE_PATTERN = /^[0-9A-Z]{4}$/;

const emptyCounts = () => ({ stocks: 0, rankings: 0, details: 0, apiCalls: 0 });

function requestIntervalFrom(env: NodeJS.ProcessEnv): number | undefined {
  const raw = Number(env.JQUANTS_REQ_INTERVAL_MS);
  return env.JQUANTS_REQ_INTERVAL_MS !== undefined && env.JQUANTS_REQ_INTERVAL_MS !== '' && Number.isFinite(raw) && raw >= 0
    ? raw
    : undefined;
}

export function removeStaleDetails(dir: string, keep: Set<string>): void {
  let names: string[];
  try {
    names = readdirSync(join(dir, DETAIL_DIR));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw e;
  }
  for (const name of names) {
    if (name.endsWith('.json') && !keep.has(name)) rmSync(join(dir, DETAIL_DIR, name), { force: true });
  }
}

export async function run(ctx: RunContext): Promise<RunResult> {
  const apiKey = ctx.env.JQUANTS_API_KEY;
  if (!apiKey) {
    return { counts: emptyCounts(), errors: ['JQUANTS_API_KEY is not set; stock data was left unchanged'] };
  }

  const client = createJQuantsClient({ apiKey, requestIntervalMs: requestIntervalFrom(ctx.env), signal: ctx.signal });
  const market = await fetchMarketData(client, {
    now: ctx.now,
    signal: ctx.signal,
    log: (line) => console.log(`  stock: ${line}`),
  });
  ctx.signal?.throwIfAborted();

  const stocks = market.stocks.filter((s) => CODE_PATTERN.test(s.code));
  const allMetrics: StockMetrics[] = [];
  for (const info of stocks) {
    const m = buildStockMetrics(info, market.statements.get(info.code) ?? [], market.prices.get(info.code));
    if (m) allMetrics.push(m);
  }
  ctx.signal?.throwIfAborted();
  if (allMetrics.length === 0) {
    return {
      counts: { ...emptyCounts(), apiCalls: market.apiCalls },
      errors: [...market.errors, 'no stock had both a statement and a price; stock data was left unchanged'],
    };
  }

  const metricsByCode = new Map(allMetrics.map((m) => [m.code, m]));
  const active = activeStrategies();
  const files: Record<string, JsonFile> = {
    'strategies.json': jsonFile(
      StrategiesFileSchema,
      strategies.map((s) => s.meta),
    ),
    'stocks.json': jsonFile(StocksFileSchema, allMetrics),
  };
  for (const strategy of active) {
    files[`ranking-${strategy.meta.id}.json`] = jsonFile(
      RankingFileSchema,
      strategy.rank(allMetrics, { limit: RANKING_LIMIT, now: ctx.now }),
    );
  }

  const detailFiles = new Set<string>();
  for (const info of stocks) {
    const statements = market.statements.get(info.code) ?? [];
    const metrics = metricsByCode.get(info.code);
    const scores: Record<string, StrategyScore> = {};
    if (metrics) for (const strategy of active) scores[strategy.meta.id] = strategy.score(metrics);

    const name = `${info.code}.json`;
    detailFiles.add(name);
    files[`${DETAIL_DIR}/${name}`] = jsonFile(
      StockDetailSchema,
      buildStockDetail(info, statements, market.prices.get(info.code), scores, ctx.now),
    );
  }

  ctx.signal?.throwIfAborted();
  writeJsonBatch(ctx.dir, files);
  ctx.signal?.throwIfAborted();
  removeStaleDetails(ctx.dir, detailFiles);

  return {
    counts: {
      stocks: allMetrics.length,
      rankings: active.length,
      details: detailFiles.size,
      apiCalls: market.apiCalls,
    },
    errors: market.errors,
  };
}

export const source: CollectorSource = { id: 'stock', run };

/// <reference types="vite/client" />
import axios from 'axios';
import { z } from 'zod';
import type {
  RankingRow,
  StockProfile,
  FinancialStatement,
  StrategyMeta,
  StrategyScore,
  StaticMeta,
  StrategyId,
} from '../lib/types';
import {
  RankingRowSchema,
  StrategyMetaSchema,
  StaticStockDetailSchema,
} from '../lib/schemas';

// VITE_STATIC_DATA=true|false always wins. Unset falls back to "static in production builds" so the
// Vercel/GitHub Pages deployments keep working without extra env. A production build served together
// with the backend must set VITE_STATIC_DATA=false.
export function resolveStaticMode(flag: string | undefined, isDev: boolean): boolean {
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return !isDev;
}

const isStatic = resolveStaticMode(import.meta.env.VITE_STATIC_DATA, import.meta.env.DEV);

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
});

// --- Static JSON fetchers ---

async function fetchStaticJson<T>(filename: string, schema: z.ZodSchema<T>): Promise<T> {
  const base = import.meta.env.BASE_URL || '/';
  const res = await fetch(`${base}data/${filename}`);
  if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return schema.parse(json);
}

// --- Strategy API ---

export async function fetchStrategies(): Promise<StrategyMeta[]> {
  if (isStatic) {
    return fetchStaticJson('strategies.json', z.array(StrategyMetaSchema));
  }
  const { data } = await api.get<StrategyMeta[]>('/strategies');
  return data;
}

export async function fetchStrategyRanking(
  id: StrategyId,
  opts?: { limit?: number; maxMarketCap?: number; minMarketCap?: number }
): Promise<RankingRow[]> {
  if (isStatic) {
    const all = await fetchStaticJson(`ranking-${id}.json`, z.array(RankingRowSchema));
    return all.slice(0, opts?.limit ?? 50);
  }
  const { data } = await api.get<RankingRow[]>(`/strategies/${id}/ranking`, { params: opts });
  return data;
}

// --- Stock API ---

export async function fetchStockDetail(code: string): Promise<StockProfile> {
  if (isStatic) {
    const detail = await fetchStaticJson(`stock-${code}.json`, StaticStockDetailSchema);
    return detail.profile;
  }
  const { data } = await api.get<StockProfile>(`/stocks/${code}`);
  return data;
}

export async function fetchStockHistory(code: string): Promise<FinancialStatement[]> {
  if (isStatic) {
    const detail = await fetchStaticJson(`stock-${code}.json`, StaticStockDetailSchema);
    return detail.history;
  }
  const { data } = await api.get<FinancialStatement[]>(`/stocks/${code}/history`);
  return data;
}

export async function fetchStockStrategies(code: string): Promise<Record<string, StrategyScore>> {
  if (isStatic) {
    const detail = await fetchStaticJson(`stock-${code}.json`, StaticStockDetailSchema);
    return detail.strategies;
  }
  const { data } = await api.get<Record<string, StrategyScore>>(`/stocks/${code}/strategies`);
  return data;
}

export type { RankingRow, StockProfile, StaticMeta };

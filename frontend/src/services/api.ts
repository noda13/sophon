/// <reference types="vite/client" />
import axios from 'axios';
import type {
  RankingRow,
  StockProfile,
  FinancialStatement,
  StrategyMeta,
  StrategyScore,
  StaticStockDetail,
  StaticMeta,
  StrategyId,
} from '../lib/types';

// In Vite production builds import.meta.env.DEV is false, so this defaults to static (GitHub Pages) mode.
// Set VITE_STATIC_DATA=false to force dynamic API mode in a production server deployment.
const isStatic = import.meta.env.VITE_STATIC_DATA === 'true' || !import.meta.env.DEV;

const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
});

// --- Static JSON fetchers ---

async function fetchStaticJson<T>(filename: string): Promise<T> {
  const base = import.meta.env.BASE_URL || '/';
  const res = await fetch(`${base}data/${filename}`);
  if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

// --- Strategy API ---

export async function fetchStrategies(): Promise<StrategyMeta[]> {
  if (isStatic) {
    return fetchStaticJson<StrategyMeta[]>('strategies.json');
  }
  const { data } = await api.get<StrategyMeta[]>('/strategies');
  return data;
}

export async function fetchStrategyRanking(
  id: StrategyId,
  opts?: { limit?: number; maxMarketCap?: number; minMarketCap?: number }
): Promise<RankingRow[]> {
  if (isStatic) {
    const all = await fetchStaticJson<RankingRow[]>(`ranking-${id}.json`);
    return all.slice(0, opts?.limit ?? 50);
  }
  const { data } = await api.get<RankingRow[]>(`/strategies/${id}/ranking`, { params: opts });
  return data;
}

// --- Stock API ---

export async function fetchStockDetail(code: string): Promise<StockProfile> {
  if (isStatic) {
    const detail = await fetchStaticJson<StaticStockDetail>(`stock-${code}.json`);
    return detail.profile;
  }
  const { data } = await api.get<StockProfile>(`/stocks/${code}`);
  return data;
}

export async function fetchStockHistory(code: string): Promise<FinancialStatement[]> {
  if (isStatic) {
    const detail = await fetchStaticJson<StaticStockDetail>(`stock-${code}.json`);
    return detail.history;
  }
  const { data } = await api.get<FinancialStatement[]>(`/stocks/${code}/history`);
  return data;
}

export async function fetchStockStrategies(code: string): Promise<Record<string, StrategyScore>> {
  if (isStatic) {
    const detail = await fetchStaticJson<StaticStockDetail>(`stock-${code}.json`);
    return detail.strategies;
  }
  const { data } = await api.get<Record<string, StrategyScore>>(`/stocks/${code}/strategies`);
  return data;
}

export type { RankingRow, StockProfile, StaticMeta };

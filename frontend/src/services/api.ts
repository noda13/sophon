/// <reference types="vite/client" />
import axios from 'axios';
import type {
  RankingRow,
  LegacyRankingRow,
  StockProfile,
  FinancialStatement,
  StrategyMeta,
  StrategyScore,
  StaticStockDetail,
  StaticMeta,
} from '../lib/types';

// Detect if running in static mode (GitHub Pages)
const isStatic = import.meta.env.VITE_STATIC_DATA === 'true' || !import.meta.env.DEV;

const api = axios.create({
  baseURL: '/api',
});

// --- Static JSON fetchers ---

async function fetchStaticJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}data/${filename}`);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// --- Strategy API ---

export async function fetchStrategies(): Promise<StrategyMeta[]> {
  if (isStatic) {
    return fetchStaticJson<StrategyMeta[]>('strategies.json', []);
  }
  const { data } = await api.get<StrategyMeta[]>('/strategies');
  return data;
}

export async function fetchStrategyRanking(
  id: string,
  opts?: { limit?: number; maxMarketCap?: number; minMarketCap?: number }
): Promise<RankingRow[]> {
  if (isStatic) {
    const all = await fetchStaticJson<RankingRow[]>(`ranking-${id}.json`, []);
    return all.slice(0, opts?.limit ?? 50);
  }
  const { data } = await api.get<RankingRow[]>(`/strategies/${id}/ranking`, { params: opts });
  return data;
}

// --- Stock API ---

export async function fetchStockDetail(code: string): Promise<StockProfile> {
  if (isStatic) {
    const detail = await fetchStaticJson<StaticStockDetail | null>(`stock-${code}.json`, null);
    if (!detail) throw new Error(`Stock ${code} not found in static data`);
    return detail.profile;
  }
  const { data } = await api.get<StockProfile>(`/stocks/${code}`);
  return data;
}

export async function fetchStockHistory(code: string): Promise<FinancialStatement[]> {
  if (isStatic) {
    const detail = await fetchStaticJson<StaticStockDetail | null>(`stock-${code}.json`, null);
    if (!detail) return [];
    return detail.history;
  }
  const { data } = await api.get<FinancialStatement[]>(`/stocks/${code}/history`);
  return data;
}

export async function fetchStockStrategies(code: string): Promise<Record<string, StrategyScore>> {
  if (isStatic) {
    const detail = await fetchStaticJson<StaticStockDetail | null>(`stock-${code}.json`, null);
    if (!detail) return {};
    return detail.strategies;
  }
  const { data } = await api.get<Record<string, StrategyScore>>(`/stocks/${code}/strategies`);
  return data;
}

// --- Legacy API (backward compat) ---

export async function fetchNetCashRanking(limit = 50): Promise<LegacyRankingRow[]> {
  if (isStatic) {
    const all = await fetchStaticJson<LegacyRankingRow[]>('ranking-ncr.json', []);
    return all.slice(0, limit);
  }
  const { data } = await api.get<LegacyRankingRow[]>('/ranking/net-cash-ratio', {
    params: { limit },
  });
  return data;
}

export async function fetchCashNeutralRanking(limit = 50): Promise<LegacyRankingRow[]> {
  if (isStatic) {
    const all = await fetchStaticJson<LegacyRankingRow[]>('ranking-cnper.json', []);
    return all.slice(0, limit);
  }
  const { data } = await api.get<LegacyRankingRow[]>('/ranking/cash-neutral-per', {
    params: { limit },
  });
  return data;
}

export async function fetchStock(code: string): Promise<StockProfile> {
  return fetchStockDetail(code);
}

export type { RankingRow, LegacyRankingRow, StockProfile, StaticMeta };

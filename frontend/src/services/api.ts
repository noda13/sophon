/// <reference types="vite/client" />
import axios from 'axios';
import type { RankingRow, StockProfile } from '../lib/types';

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
    return await res.json() as T;
  } catch {
    return fallback;
  }
}

// --- API functions ---

export async function fetchNetCashRanking(limit = 50): Promise<RankingRow[]> {
  if (isStatic) {
    const all = await fetchStaticJson<RankingRow[]>('ranking-ncr.json', []);
    return all.slice(0, limit);
  }
  const { data } = await api.get<RankingRow[]>('/ranking/net-cash-ratio', { params: { limit } });
  return data;
}

export async function fetchCashNeutralRanking(limit = 50): Promise<RankingRow[]> {
  if (isStatic) {
    const all = await fetchStaticJson<RankingRow[]>('ranking-cnper.json', []);
    return all.slice(0, limit);
  }
  const { data } = await api.get<RankingRow[]>('/ranking/cash-neutral-per', { params: { limit } });
  return data;
}

export async function fetchStock(code: string): Promise<StockProfile> {
  if (isStatic) {
    const stocks = await fetchStaticJson<StockProfile[]>('stocks.json', []);
    const found = stocks.find(s => s.code === code);
    if (!found) throw new Error(`Stock ${code} not found in static data`);
    return found;
  }
  const { data } = await api.get<StockProfile>(`/stocks/${code}`);
  return data;
}

export { RankingRow, StockProfile };

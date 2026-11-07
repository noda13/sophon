import type { ActionSignal } from './types/profile';
import { SIGNAL_BOUNDS } from './riskThresholds';

export interface SignalConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const ACTION_SIGNAL_CONFIG: Record<ActionSignal, SignalConfig> = {
  hold: {
    label: '様子見',
    color: 'text-green-400',
    bgColor: 'bg-green-900/30',
    borderColor: 'border-green-500',
    description: '現状維持で問題ありません',
  },
  watch: {
    label: '注視',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-500',
    description: '市場動向を注視してください',
  },
  prepare: {
    label: '準備',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500',
    description: 'リバランス計画の策定を検討してください',
  },
  hedge: {
    label: 'ヘッジ検討',
    color: 'text-red-400',
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500',
    description: 'ポートフォリオの防御的調整を検討してください',
  },
  act: {
    label: '即時対応',
    color: 'text-red-300',
    bgColor: 'bg-red-950/50',
    borderColor: 'border-red-400',
    description: 'リスク資産の大幅な見直しを検討してください',
  },
};

/** Returns null for a non-finite score so missing data is never shown as the worst signal. */
export function getSignalFromScore(score: number): ActionSignal | null {
  if (!Number.isFinite(score)) return null;
  if (score <= SIGNAL_BOUNDS.hold) return 'hold';
  if (score <= SIGNAL_BOUNDS.watch) return 'watch';
  if (score <= SIGNAL_BOUNDS.prepare) return 'prepare';
  if (score <= SIGNAL_BOUNDS.hedge) return 'hedge';
  return 'act';
}

import type { ActionSignal } from './profile';
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
    color: 'text-risk-low',
    bgColor: 'bg-success-muted',
    borderColor: 'border-risk-low',
    description: '現状維持で問題ありません',
  },
  watch: {
    label: '注視',
    color: 'text-risk-moderate',
    bgColor: 'bg-warning-muted',
    borderColor: 'border-risk-moderate',
    description: '市場動向を注視してください',
  },
  prepare: {
    label: '準備',
    color: 'text-risk-high',
    bgColor: 'bg-warning-muted',
    borderColor: 'border-risk-high',
    description: 'リバランス計画の策定を検討してください',
  },
  hedge: {
    label: 'ヘッジ検討',
    color: 'text-danger',
    bgColor: 'bg-danger-muted',
    borderColor: 'border-danger',
    description: 'ポートフォリオの防御的調整を検討してください',
  },
  act: {
    label: '即時対応',
    color: 'text-risk-critical',
    bgColor: 'bg-danger-muted',
    borderColor: 'border-risk-critical',
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

import type { ScoreLevel, Tone } from '../logic/formatters';

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success',
  fair: 'text-warning',
  poor: 'text-danger',
  none: 'text-fg-muted',
};

export const TONE_BADGE: Record<Tone, string> = {
  good: 'bg-success-muted text-success',
  fair: 'bg-warning-muted text-warning',
  poor: 'bg-surface-overlay text-fg-muted',
  none: 'bg-surface-overlay text-fg-muted',
};

export const LEVEL_BADGE: Record<ScoreLevel, string> = {
  high: 'bg-success-muted text-success',
  upper: 'bg-info-muted text-info',
  middle: 'bg-warning-muted text-warning',
  low: 'bg-surface-overlay text-fg-muted',
};

export const LEVEL_BAR: Record<ScoreLevel, string> = {
  high: 'bg-success',
  upper: 'bg-info',
  middle: 'bg-warning',
  low: 'bg-fg-subtle',
};

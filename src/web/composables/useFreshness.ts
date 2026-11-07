import { useMemo } from 'react';
import type { z } from 'zod';
import {
  type AnyMetaSchema,
  type LegacyMeta,
  type Meta,
  MetaSchema,
  legacyToMeta,
} from '../../shared/schema/meta';

type AnyMeta = z.infer<typeof AnyMetaSchema>;

export type Health = 'ok' | 'partial' | 'failed' | 'unknown';

export interface Freshness {
  generatedAt: Date | null;
  isStale: boolean;
  ageHours: number | null;
  health: Health;
  errors: string[];
}

export interface FreshnessOptions {
  staleAfterHours?: number;
  now?: Date | number;
}

const MS_PER_HOUR = 3_600_000;
const DEFAULT_STALE_AFTER_HOURS = 36;
// legacyToMeta は source を結果に載せるだけで、鮮度の判定には使わない
const PLACEHOLDER_SOURCE = 'stock';

const UNKNOWN: Freshness = {
  generatedAt: null,
  isStale: false,
  ageHours: null,
  health: 'unknown',
  errors: [],
};

function normalize(meta: AnyMeta | undefined): Meta | null {
  if (!meta) return null;
  const current = MetaSchema.safeParse(meta);
  if (current.success) return current.data;
  return legacyToMeta(PLACEHOLDER_SOURCE, meta as LegacyMeta);
}

export function computeFreshness(
  meta: AnyMeta | undefined,
  { staleAfterHours = DEFAULT_STALE_AFTER_HOURS, now = Date.now() }: FreshnessOptions = {},
): Freshness {
  const normalized = normalize(meta);
  if (!normalized) return UNKNOWN;

  const generatedAt = new Date(normalized.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) {
    return { ...UNKNOWN, health: normalized.run.status, errors: normalized.run.errors };
  }

  const nowMs = typeof now === 'number' ? now : now.getTime();
  const ageHours = Math.max(0, (nowMs - generatedAt.getTime()) / MS_PER_HOUR);
  return {
    generatedAt,
    ageHours,
    // ちょうど閾値の時刻は古いとみなさない
    isStale: ageHours > staleAfterHours,
    health: normalized.run.status,
    errors: normalized.run.errors,
  };
}

export function useFreshness(meta: AnyMeta | undefined, options: FreshnessOptions = {}): Freshness {
  const { staleAfterHours, now } = options;
  const nowMs = now === undefined ? undefined : typeof now === 'number' ? now : now.getTime();
  return useMemo(
    () => computeFreshness(meta, { staleAfterHours, now: nowMs }),
    [meta, staleAfterHours, nowMs],
  );
}

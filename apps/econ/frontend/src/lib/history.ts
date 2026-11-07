const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps entries within `days` of the newest entry, not of the wall clock, so a
 * stale data file still yields its latest window instead of an empty chart.
 */
export function filterRecentHistory<T extends { assessedAt: string }>(entries: T[], days: number): T[] {
  const timestamps = entries.map((entry) => new Date(entry.assessedAt).getTime());
  const latest = Math.max(...timestamps.filter(Number.isFinite));
  if (!Number.isFinite(latest)) return [];
  const cutoff = latest - days * DAY_MS;
  return entries.filter((_, i) => timestamps[i] >= cutoff);
}

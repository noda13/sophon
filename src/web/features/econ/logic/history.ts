const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps entries within `days` of the newest entry, not of the wall clock, so a
 * stale data file still yields its latest window instead of an empty chart.
 */
export function filterRecentHistory<T extends { assessedAt: string }>(entries: T[], days: number): T[] {
  const stamped = entries.map((entry) => ({ entry, time: new Date(entry.assessedAt).getTime() }));
  const latest = Math.max(...stamped.map((s) => s.time).filter(Number.isFinite));
  if (!Number.isFinite(latest)) return [];
  const cutoff = latest - days * DAY_MS;
  return stamped.filter((s) => s.time >= cutoff).map((s) => s.entry);
}

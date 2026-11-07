import { describe, expect, it } from 'vitest';
import { filterRecentHistory } from './history';

const entry = (assessedAt: string) => ({ assessedAt });

describe('filterRecentHistory', () => {
  it('keeps only entries within the window ending at the newest entry', () => {
    const entries = [entry('2026-06-01T00:00:00Z'), entry('2026-07-05T00:00:00Z'), entry('2026-08-04T00:00:00Z')];
    expect(filterRecentHistory(entries, 30)).toEqual([entry('2026-07-05T00:00:00Z'), entry('2026-08-04T00:00:00Z')]);
  });

  it('does not depend on the current date, so stale data still produces a window', () => {
    const entries = [entry('2001-01-01T00:00:00Z'), entry('2001-01-02T00:00:00Z')];
    expect(filterRecentHistory(entries, 30)).toHaveLength(2);
  });

  it('includes an entry exactly at the cutoff', () => {
    const entries = [entry('2026-07-05T00:00:00Z'), entry('2026-08-04T00:00:00Z')];
    expect(filterRecentHistory(entries, 30)).toHaveLength(2);
  });

  it('returns an empty list for no entries or only unparseable dates', () => {
    expect(filterRecentHistory([], 30)).toEqual([]);
    expect(filterRecentHistory([entry('not-a-date')], 30)).toEqual([]);
  });

  it('drops unparseable entries but keeps the valid ones', () => {
    expect(filterRecentHistory([entry('not-a-date'), entry('2026-08-04T00:00:00Z')], 30)).toEqual([
      entry('2026-08-04T00:00:00Z'),
    ]);
  });
});

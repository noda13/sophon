import { describe, expect, it } from 'vitest';
import { adjacentDates, latestDate } from './digestDates';

const dates = ['2026-11-07', '2026-11-05', '2026-11-02'];

describe('adjacentDates', () => {
  it('一覧にある日は、隣の日を返す', () => {
    expect(adjacentDates(dates, '2026-11-05')).toEqual({ prev: '2026-11-02', next: '2026-11-07' });
  });

  it('端では片側が null になる', () => {
    expect(adjacentDates(dates, '2026-11-07')).toEqual({ prev: '2026-11-05', next: null });
    expect(adjacentDates(dates, '2026-11-02')).toEqual({ prev: null, next: '2026-11-05' });
  });

  it('一覧にない日は、前後で最も近い日を返す', () => {
    expect(adjacentDates(dates, '2026-11-06')).toEqual({ prev: '2026-11-05', next: '2026-11-07' });
  });

  it('一覧が空なら両方 null', () => {
    expect(adjacentDates([], '2026-11-06')).toEqual({ prev: null, next: null });
  });
});

describe('latestDate', () => {
  it('最も新しい日を返す。空なら undefined', () => {
    expect(latestDate(dates)).toBe('2026-11-07');
    expect(latestDate([])).toBeUndefined();
  });
});

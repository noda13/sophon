import { describe, expect, it } from 'vitest';
import { checkEventCoverage, ECONOMIC_EVENTS, type EconomicEvent } from '../economic-events.js';
import { selectUpcomingEvents } from './events.js';

function ev(date: string, titleJa = date): EconomicEvent {
  return { date, titleJa, region: 'US', importance: 'high' };
}

const dates = (events: EconomicEvent[]) => events.map(e => e.date);

describe('selectUpcomingEvents', () => {
  const sample = [ev('2026-10-26'), ev('2026-10-27'), ev('2026-10-28'), ev('2026-10-29')];

  it('uses the Asia/Tokyo calendar day, so 15:30Z on the 27th is already the 28th', () => {
    const result = selectUpcomingEvents(new Date('2026-10-27T15:30:00Z'), 30, sample);
    expect(dates(result)).toEqual(['2026-10-28', '2026-10-29']);
  });

  it('still counts the 27th as today at 14:59:59Z, one second before JST midnight', () => {
    const result = selectUpcomingEvents(new Date('2026-10-27T14:59:59Z'), 30, sample);
    expect(dates(result)).toEqual(['2026-10-27', '2026-10-28', '2026-10-29']);
  });

  it('rolls over to the 28th exactly at 15:00:00Z', () => {
    const result = selectUpcomingEvents(new Date('2026-10-27T15:00:00Z'), 30, sample);
    expect(dates(result)).toEqual(['2026-10-28', '2026-10-29']);
  });

  it('includes events on the current JST day regardless of the time of day', () => {
    const result = selectUpcomingEvents(new Date('2026-10-28T14:59:59Z'), 0, sample);
    expect(dates(result)).toEqual(['2026-10-28']);
  });

  it('excludes events from before today', () => {
    const result = selectUpcomingEvents(new Date('2026-10-28T03:00:00Z'), 30, sample);
    expect(dates(result)).not.toContain('2026-10-27');
  });

  it('includes the event exactly 30 days ahead and excludes the one 31 days ahead', () => {
    const events = [ev('2026-11-27'), ev('2026-11-28')];
    const result = selectUpcomingEvents(new Date('2026-10-28T00:00:00Z'), 30, events);
    expect(dates(result)).toEqual(['2026-11-27']);
  });

  it('computes the window end in JST when the UTC instant is still the previous day', () => {
    const events = [ev('2026-11-26'), ev('2026-11-27'), ev('2026-11-28')];
    const result = selectUpcomingEvents(new Date('2026-10-27T15:30:00Z'), 30, events);
    expect(dates(result)).toEqual(['2026-11-26', '2026-11-27']);
  });

  it('honours a custom number of days with inclusive ends', () => {
    const events = [ev('2026-10-24'), ev('2026-10-25'), ev('2026-10-26'), ev('2026-10-27')];
    const result = selectUpcomingEvents(new Date('2026-10-24T00:00:00Z'), 2, events);
    expect(dates(result)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('defaults to a 30 day window', () => {
    const events = [ev('2026-11-23'), ev('2026-11-24')];
    const result = selectUpcomingEvents(new Date('2026-10-24T00:00:00Z'), undefined, events);
    expect(dates(result)).toEqual(['2026-11-23']);
  });

  it('crosses the year boundary correctly', () => {
    const events = [ev('2026-12-31'), ev('2027-01-01'), ev('2027-01-31'), ev('2027-02-01')];
    const result = selectUpcomingEvents(new Date('2026-12-31T15:00:00Z'), 30, events);
    expect(dates(result)).toEqual(['2027-01-01', '2027-01-31']);
  });

  it('keeps every event that shares a date', () => {
    const events = [ev('2026-10-28', 'FOMC'), ev('2026-10-28', 'GDP')];
    const result = selectUpcomingEvents(new Date('2026-10-28T00:00:00Z'), 0, events);
    expect(result.map(e => e.titleJa)).toEqual(['FOMC', 'GDP']);
  });

  it('returns an empty array when nothing is in range', () => {
    expect(selectUpcomingEvents(new Date('2026-10-24T00:00:00Z'), 30, [ev('2026-01-01')])).toEqual([]);
    expect(selectUpcomingEvents(new Date('2026-10-24T00:00:00Z'), 30, [])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const events = [ev('2026-10-30'), ev('2026-10-25')];
    const snapshot = [...events];
    selectUpcomingEvents(new Date('2026-10-24T00:00:00Z'), 30, events);
    expect(events).toEqual(snapshot);
  });

  it('reads ECONOMIC_EVENTS by default and returns them in ascending date order', () => {
    const result = selectUpcomingEvents(new Date('2026-10-24T00:00:00Z'));
    expect(dates(result)).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-29',
      '2026-10-30',
      '2026-11-06',
      '2026-11-10',
      '2026-11-16',
    ]);
  });
});

describe('ECONOMIC_EVENTS data integrity', () => {
  const byTitle = (needle: string, year = '2026') =>
    ECONOMIC_EVENTS.filter(e => e.titleJa.includes(needle) && e.date.startsWith(`${year}-`)).map(e => e.date);

  it('uses valid YYYY-MM-DD calendar dates', () => {
    for (const e of ECONOMIC_EVENTS) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const roundTrip = new Date(`${e.date}T00:00:00Z`).toISOString().slice(0, 10);
      expect(roundTrip, `invalid calendar date ${e.date}`).toBe(e.date);
    }
  });

  it('is sorted by date ascending', () => {
    const all = dates(ECONOMIC_EVENTS);
    expect(all).toEqual([...all].sort());
  });

  it('has no exact duplicates', () => {
    const keys = ECONOMIC_EVENTS.map(e => `${e.date}|${e.region}|${e.titleJa}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a non-empty title, a known region and a known importance on every event', () => {
    for (const e of ECONOMIC_EVENTS) {
      expect(e.titleJa.trim()).not.toBe('');
      expect(['US', 'JP', 'EU', 'GLOBAL']).toContain(e.region);
      expect(['high', 'medium']).toContain(e.importance);
    }
  });

  it('matches the official 2026 FOMC decision dates', () => {
    expect(byTitle('FOMC')).toEqual([
      '2026-01-28',
      '2026-03-18',
      '2026-04-29',
      '2026-06-17',
      '2026-07-29',
      '2026-09-16',
      '2026-10-28',
      '2026-12-09',
    ]);
  });

  it('matches the official 2026 ECB monetary policy decision dates', () => {
    expect(byTitle('ECB')).toEqual([
      '2026-02-05',
      '2026-03-19',
      '2026-04-30',
      '2026-06-11',
      '2026-07-23',
      '2026-09-10',
      '2026-10-29',
      '2026-12-17',
    ]);
  });

  it('tags FOMC events as US and ECB events as EU', () => {
    for (const e of ECONOMIC_EVENTS.filter(e => e.titleJa.includes('FOMC'))) expect(e.region).toBe('US');
    for (const e of ECONOMIC_EVENTS.filter(e => e.titleJa.includes('ECB'))) expect(e.region).toBe('EU');
  });

  it('never schedules an event on a weekend', () => {
    for (const e of ECONOMIC_EVENTS) {
      const weekday = new Date(`${e.date}T00:00:00Z`).getUTCDay();
      expect([0, 6], `${e.date} ${e.titleJa} falls on a weekend`).not.toContain(weekday);
    }
  });

  it('holds FOMC decisions on Wednesdays, ECB decisions on Thursdays and the jobs report on Fridays', () => {
    const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
    const all = (needle: string) => ECONOMIC_EVENTS.filter(e => e.titleJa.includes(needle)).map(e => e.date);
    // BLS moves the release earlier when Friday is a federal holiday (2026-07-03) and delayed 2026-02-11 after a shutdown.
    const holidayEves = new Set(['2026-07-02']);
    const delayedReleases = new Set(['2026-02-11']);
    for (const d of all('FOMC')) expect(weekdayOf(d), `FOMC ${d}`).toBe(3);
    for (const d of all('ECB')) expect(weekdayOf(d), `ECB ${d}`).toBe(4);
    for (const d of all('雇用統計')) {
      if (holidayEves.has(d)) expect(weekdayOf(d), `jobs report ${d}`).toBe(4);
      else if (!delayedReleases.has(d)) expect(weekdayOf(d), `jobs report ${d}`).toBe(5);
    }
  });

  it('matches the official 2026-2027 BOJ decision dates (second day of each meeting)', () => {
    expect(byTitle('日銀', '2026')).toEqual([
      '2026-01-23', '2026-03-19', '2026-04-28', '2026-06-16', '2026-07-31', '2026-09-18', '2026-10-30', '2026-12-18',
    ]);
    expect(byTitle('日銀', '2027')).toEqual([
      '2027-01-22', '2027-03-18', '2027-04-28', '2027-06-11', '2027-07-22', '2027-09-22', '2027-10-29', '2027-12-17',
    ]);
  });
});

describe('checkEventCoverage', () => {
  const events = [ev('2026-12-18')];

  it('warns when the last event is already in the past', () => {
    expect(checkEventCoverage(new Date('2026-12-19T00:00:00Z'), 60, events)).toMatch(/no events after 2026-12-18/);
  });

  it('warns when the last event is closer than the minimum horizon', () => {
    expect(checkEventCoverage(new Date('2026-11-07T00:00:00Z'), 60, events)).toMatch(/ends on 2026-12-18 \(41 days ahead/);
  });

  it('returns null when the horizon is long enough', () => {
    expect(checkEventCoverage(new Date('2026-10-01T00:00:00Z'), 60, events)).toBeNull();
  });

  it('warns on an empty list', () => {
    expect(checkEventCoverage(new Date('2026-10-01T00:00:00Z'), 60, [])).not.toBeNull();
  });
});

import { ECONOMIC_EVENTS, type EconomicEvent } from '../economic-events.js';

const JST_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' });
const DAY_MS = 24 * 60 * 60 * 1000;

export function selectUpcomingEvents(now: Date, days = 30, events: EconomicEvent[] = ECONOMIC_EVENTS): EconomicEvent[] {
  const todayStr = JST_DATE.format(now);
  const limitStr = JST_DATE.format(new Date(now.getTime() + days * DAY_MS));
  return events.filter(e => e.date >= todayStr && e.date <= limitStr);
}

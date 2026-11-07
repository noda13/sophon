// NOTE: This file must be updated annually. Events listed for 2026 and 2027.
// 2026-2027: FOMC, ECB, BOJ (decision day = day 2 of each meeting), BLS jobs report and CPI dates, and the
// US GDP advance estimates for 2026, and the 2026 Japan GDP preliminary releases were checked against the official
// calendars. FOMC 2027 dates are tentative per the Fed. 2027-02-15 (Japan GDP) is the Cabinet Office's tentative
// schedule; later 2027 Japan GDP releases are unpublished and not listed.
// The jobs report moves off Friday when a holiday or a shutdown shifts it (2026-02-11, 2026-07-02).

export interface EconomicEvent {
  date: string;        // ISO date string (YYYY-MM-DD)
  titleJa: string;     // Japanese event title
  region: 'US' | 'JP' | 'EU' | 'GLOBAL';
  importance: 'high' | 'medium';
}

export const ECONOMIC_EVENTS: EconomicEvent[] = [
  // January 2026
  { date: '2026-01-09', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-01-13', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-01-23', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2026-01-28', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },

  // February 2026
  { date: '2026-02-05', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-02-11', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-02-13', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-02-16', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },
  { date: '2026-02-20', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },

  // March 2026
  { date: '2026-03-06', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-03-11', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-03-18', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-03-19', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-03-19', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // April 2026
  { date: '2026-04-03', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-04-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-04-28', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2026-04-29', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-04-30', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-04-30', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },

  // May 2026
  { date: '2026-05-08', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-05-12', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-05-19', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // June 2026
  { date: '2026-06-05', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-06-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-06-11', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-06-16', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2026-06-17', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },

  // July 2026
  { date: '2026-07-02', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-07-14', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-07-23', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-07-29', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-07-30', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },
  { date: '2026-07-31', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // August 2026
  { date: '2026-08-07', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-08-12', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-08-17', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // September 2026
  { date: '2026-09-04', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-09-10', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-09-11', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-09-16', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-09-18', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // October 2026
  { date: '2026-10-02', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-10-14', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-10-28', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-10-29', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-10-29', titleJa: '米GDP速報値発表', region: 'US', importance: 'medium' },
  { date: '2026-10-30', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // November 2026
  { date: '2026-11-06', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-11-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-11-16', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // December 2026
  { date: '2026-12-04', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2026-12-09', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2026-12-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2026-12-17', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2026-12-18', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // January 2027
  { date: '2027-01-08', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-01-13', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-01-22', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2027-01-27', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },

  // February 2027
  { date: '2027-02-04', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2027-02-05', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-02-11', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-02-15', titleJa: '日本GDP速報値発表', region: 'JP', importance: 'medium' },

  // March 2027
  { date: '2027-03-05', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-03-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-03-17', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2027-03-18', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2027-03-18', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // April 2027
  { date: '2027-04-02', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-04-13', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-04-28', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2027-04-28', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2027-04-29', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },

  // May 2027
  { date: '2027-05-07', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-05-12', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },

  // June 2027
  { date: '2027-06-04', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-06-09', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2027-06-10', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2027-06-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-06-11', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // July 2027
  { date: '2027-07-02', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-07-14', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-07-22', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2027-07-22', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
  { date: '2027-07-28', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },

  // August 2027
  { date: '2027-08-06', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-08-11', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },

  // September 2027
  { date: '2027-09-03', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-09-09', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2027-09-14', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-09-15', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2027-09-22', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // October 2027
  { date: '2027-10-08', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-10-14', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-10-27', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2027-10-28', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2027-10-29', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },

  // November 2027
  { date: '2027-11-05', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-11-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },

  // December 2027
  { date: '2027-12-03', titleJa: '米雇用統計(非農業部門雇用者数)発表', region: 'US', importance: 'high' },
  { date: '2027-12-08', titleJa: 'FOMC政策金利発表', region: 'US', importance: 'high' },
  { date: '2027-12-10', titleJa: '米CPI(消費者物価指数)発表', region: 'US', importance: 'high' },
  { date: '2027-12-16', titleJa: 'ECB理事会(政策金利決定)', region: 'EU', importance: 'high' },
  { date: '2027-12-17', titleJa: '日銀金融政策決定会合', region: 'JP', importance: 'high' },
];

// Collection runs on a manual dispatch, so the data can go stale unnoticed; this makes the gap visible in the log.
export function checkEventCoverage(
  now: Date,
  minDaysAhead = 60,
  events: readonly EconomicEvent[] = ECONOMIC_EVENTS,
): string | null {
  const last = events.reduce((max, e) => (e.date > max ? e.date : max), '');
  const daysLeft = last ? Math.floor((Date.parse(`${last}T00:00:00Z`) - now.getTime()) / 86_400_000) : -1;
  if (daysLeft >= minDaysAhead) return null;
  return daysLeft < 0
    ? `ECONOMIC_EVENTS has no events after ${last || 'N/A'}; the upcoming-events list will be empty. Update scripts/economic-events.ts.`
    : `ECONOMIC_EVENTS ends on ${last} (${daysLeft} days ahead, below ${minDaysAhead}). Update scripts/economic-events.ts.`;
}

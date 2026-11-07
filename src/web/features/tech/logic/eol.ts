import { EOL_NO_DATE_DAYS, type EolItem } from '../../../../shared/schema/tech';

export type EolTone = 'unknown' | 'expired' | 'critical' | 'warning' | 'safe';

export const EOL_CRITICAL_DAYS = 90;
export const EOL_WARNING_DAYS = 180;

export interface EolStatus {
  tone: EolTone;
  label: string;
}

export function eolStatus(daysLeft: number): EolStatus {
  if (daysLeft >= EOL_NO_DATE_DAYS) return { tone: 'unknown', label: 'EOL未定' };
  if (daysLeft < 0) return { tone: 'expired', label: 'EOL済' };
  const label = `残${daysLeft}日`;
  if (daysLeft < EOL_CRITICAL_DAYS) return { tone: 'critical', label };
  if (daysLeft < EOL_WARNING_DAYS) return { tone: 'warning', label };
  return { tone: 'safe', label };
}

export function formatEolDate(eol: EolItem['eol']): string {
  return eol === false ? '—' : eol;
}

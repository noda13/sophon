import { describe, expect, it } from 'vitest';
import { EOL_NO_DATE_DAYS } from '../../../../shared/schema/tech';
import { eolStatus, formatEolDate } from './eol';

describe('eolStatus', () => {
  it.each([
    [EOL_NO_DATE_DAYS, 'unknown', 'EOL未定'],
    [-1, 'expired', 'EOL済'],
    [0, 'critical', '残0日'],
    [89, 'critical', '残89日'],
    [90, 'warning', '残90日'],
    [179, 'warning', '残179日'],
    [180, 'safe', '残180日'],
  ])('daysLeft=%i は %s', (days, tone, label) => {
    expect(eolStatus(days)).toEqual({ tone, label });
  });
});

describe('formatEolDate', () => {
  it('日付なしはダッシュにする', () => {
    expect(formatEolDate(false)).toBe('—');
    expect(formatEolDate('2028-04-30')).toBe('2028-04-30');
  });
});

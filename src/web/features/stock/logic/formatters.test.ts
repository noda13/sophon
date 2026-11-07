import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  formatDate,
  formatPer,
  formatRatio,
  formatYen,
  netCashRatioTone,
  netCashTone,
  scoreBarPercent,
  scoreLevel,
} from './formatters';

describe('formatYen', () => {
  it('桁に応じて兆・億・万・円で表す', () => {
    expect(formatYen(1_500_000_000_000)).toBe('1.5兆円');
    expect(formatYen(61_524_341_480)).toBe('615.2億円');
    expect(formatYen(250_000)).toBe('25万円');
    expect(formatYen(9_999)).toBe('9999円');
  });

  it('負の値は符号を先頭に付ける', () => {
    expect(formatYen(-146_800_000_000)).toBe('-1468.0億円');
  });

  it('null と undefined は空表示にする', () => {
    expect(formatYen(null)).toBe(EMPTY_VALUE);
    expect(formatYen(undefined)).toBe(EMPTY_VALUE);
  });
});

describe('formatRatio / formatPer', () => {
  it('比率は小数2桁、倍率は小数1桁に丸める', () => {
    expect(formatRatio(1.2)).toBe('1.20');
    expect(formatPer(10.827)).toBe('10.8x');
  });

  it('負の倍率には過剰と添える', () => {
    expect(formatPer(-3.14)).toBe('-3.1x (過剰)');
  });

  it('null は空表示にする', () => {
    expect(formatRatio(null)).toBe(EMPTY_VALUE);
    expect(formatPer(null)).toBe(EMPTY_VALUE);
  });
});

describe('formatDate', () => {
  it('不正な日付と空は空表示にする', () => {
    expect(formatDate('not a date')).toBe(EMPTY_VALUE);
    expect(formatDate(null)).toBe(EMPTY_VALUE);
  });
});

describe('tone', () => {
  it('NCR は 1.0 と 0.3 を境に分ける', () => {
    expect(netCashRatioTone(1)).toBe('good');
    expect(netCashRatioTone(0.3)).toBe('fair');
    expect(netCashRatioTone(0.29)).toBe('poor');
    expect(netCashRatioTone(null)).toBe('none');
  });

  it('ネットキャッシュは 0 以上を良とする', () => {
    expect(netCashTone(0)).toBe('good');
    expect(netCashTone(-1)).toBe('poor');
    expect(netCashTone(null)).toBe('none');
  });

  it('スコアは 75、55、40 を境に分ける', () => {
    expect([80, 75, 60, 55, 45, 40, 39].map(scoreLevel)).toEqual([
      'high',
      'high',
      'upper',
      'upper',
      'middle',
      'middle',
      'low',
    ]);
  });

  it('バーの幅は 0 から 100 に収める', () => {
    expect(scoreBarPercent(-5)).toBe(0);
    expect(scoreBarPercent(130)).toBe(100);
    expect(scoreBarPercent(42)).toBe(42);
  });
});

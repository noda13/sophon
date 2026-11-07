import { describe, expect, it } from 'vitest';
import { categoryLabel, difficultyLabel, difficultyTone, formatRelativeDate, formatScore } from './format';

const NOW = Date.parse('2026-11-07T12:00:00Z');

describe('formatRelativeDate', () => {
  it.each([
    ['2026-11-07T11:59:30Z', 'たった今'],
    ['2026-11-07T11:30:00Z', '30分前'],
    ['2026-11-07T07:00:00Z', '5時間前'],
    ['2026-11-04T12:00:00Z', '3日前'],
    ['2026-08-07T12:00:00Z', '3ヶ月前'],
    ['2024-11-07T12:00:00Z', '2年前'],
    ['2026-11-08T12:00:00Z', 'たった今'],
    ['broken', '---'],
  ])('%s -> %s', (input, expected) => {
    expect(formatRelativeDate(input, NOW)).toBe(expected);
  });
});

describe('labels', () => {
  it('未分類と未生成を扱える', () => {
    expect(categoryLabel('')).toBe('未分類');
    expect(categoryLabel('governance')).toBe('行政・制度');
    expect(difficultyLabel('')).toBe('難易度:不明');
    expect(difficultyLabel('low')).toBe('難易度:低');
    expect(difficultyTone('high')).toBe('danger');
    expect(difficultyTone('')).toBe('neutral');
  });

  it('スコアは整数に丸める', () => {
    expect(formatScore(72.4)).toBe('72/100');
  });
});

import { describe, expect, it } from 'vitest';
import { applyClassification, classifyTargets, clampScore, normalizeCategory } from './classify';
import { newIssue } from './feeds';
import type { Issue } from '../../../shared/schema/issue';

const now = new Date('2026-11-07T00:00:00.000Z');
const make = (over: Partial<Issue> = {}): Issue => ({
  ...newIssue(
    { id: 'x', title: 't', url: 'https://example.com/a', publishedAt: '2026-11-06T00:00:00.000Z', summary: '' },
    { url: 'https://example.com/feed', source: 'nhk', sourceType: 'news_jp' },
    now,
  ),
  ...over,
});

describe('clampScore', () => {
  it('rounds and clamps to 0-100', () => {
    expect(clampScore(72.6)).toBe(73);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(140)).toBe(100);
  });

  it('maps non-finite values to 0', () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('normalizeCategory', () => {
  it('keeps valid categories, tolerating case and whitespace', () => {
    expect(normalizeCategory('aging_care')).toBe('aging_care');
    expect(normalizeCategory(' Education ')).toBe('education');
  });

  it('falls back to governance for anything else', () => {
    expect(normalizeCategory('sports')).toBe('governance');
    expect(normalizeCategory('')).toBe('governance');
  });
});

describe('applyClassification', () => {
  it('writes normalized fields and classifiedAt', () => {
    const issue = make();
    applyClassification(
      issue,
      {
        index: 0,
        summaryJa: '要約',
        category: 'unknown',
        severityScore: 101,
        urgencyScore: 49.5,
        appifiabilityScore: 60,
        affectedDomain: ['高齢者'],
      },
      now,
    );
    expect(issue).toMatchObject({
      summaryJa: '要約',
      category: 'governance',
      severityScore: 100,
      urgencyScore: 50,
      appifiabilityScore: 60,
      affectedDomain: ['高齢者'],
      classifiedAt: now.toISOString(),
    });
  });
});

describe('classifyTargets', () => {
  it('selects only unclassified issues', () => {
    const a = make({ id: 'a' });
    const b = make({ id: 'b', classifiedAt: now.toISOString() });
    expect(classifyTargets([a, b])).toEqual([a]);
  });
});


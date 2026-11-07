import { describe, expect, it } from 'vitest';
import { TECH_CATEGORIES } from '../../../shared/schema/tech';
import { TECH_FEEDS } from './feeds';

describe('TECH_FEEDS', () => {
  it('has unique sources and https urls', () => {
    expect(new Set(TECH_FEEDS.map((f) => f.source)).size).toBe(TECH_FEEDS.length);
    for (const f of TECH_FEEDS) expect(f.url).toMatch(/^https:\/\//);
  });

  it('covers every category', () => {
    for (const c of TECH_CATEGORIES) expect(TECH_FEEDS.some((f) => f.hint === c)).toBe(true);
  });

  it('no longer lists the feed that returns 404', () => {
    expect(TECH_FEEDS.some((f) => f.source === 'anthropic')).toBe(false);
    expect(TECH_FEEDS.some((f) => f.source === 'openai')).toBe(true);
  });
});

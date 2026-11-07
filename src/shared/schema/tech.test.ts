import { describe, expect, it } from 'vitest';
import { listLegacyFiles, readLegacyJson } from './legacy-data.testutil';
import { ArticlesFileSchema, DigestSchema, EolFileSchema } from './tech';

describe('tech schema against legacy data', () => {
  it('parses articles.json', () => {
    expect(ArticlesFileSchema.safeParse(readLegacyJson('tech', 'articles.json')).success).toBe(true);
  });

  it('parses eol.json', () => {
    expect(EolFileSchema.safeParse(readLegacyJson('tech', 'eol.json')).success).toBe(true);
  });

  it('parses digest-latest.json', () => {
    expect(DigestSchema.safeParse(readLegacyJson('tech', 'digest-latest.json')).success).toBe(true);
  });

  it('parses every dated digest if present', () => {
    for (const f of listLegacyFiles('tech').filter((f) => /^digest-\d{4}/.test(f))) {
      expect(DigestSchema.safeParse(readLegacyJson('tech', f)).success).toBe(true);
    }
  });

  it('rejects an unknown category', () => {
    expect(ArticlesFileSchema.safeParse([{ id: '1', source: 's', category: 'x', importance: '中', originalTitle: '', originalUrl: '', publishedAt: '', summaryJa: '' }]).success).toBe(false);
  });
});

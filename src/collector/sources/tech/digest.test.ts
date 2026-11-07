import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Article } from '../../../shared/schema/tech';
import { assembleDigest, listDigestDates, rankByImportance, selectDigestCandidates } from './digest';

const article = (id: string, over: Partial<Article> = {}): Article => ({
  id,
  source: 's',
  category: 'trend',
  importance: '中',
  originalTitle: id,
  originalUrl: `https://e.com/${id}`,
  publishedAt: '2026-11-01T00:00:00.000Z',
  summaryJa: '要約',
  ...over,
});

describe('rankByImportance', () => {
  it('orders 高, 中, 低 and breaks ties by newest first without mutating the input', () => {
    const input = [
      article('low', { importance: '低' }),
      article('mid-old', { publishedAt: '2026-10-01T00:00:00.000Z' }),
      article('high', { importance: '高', publishedAt: '2026-09-01T00:00:00.000Z' }),
      article('mid-new'),
    ];
    expect(rankByImportance(input).map((a) => a.id)).toEqual(['high', 'mid-new', 'mid-old', 'low']);
    expect(input[0]!.id).toBe('low');
  });
});

describe('selectDigestCandidates', () => {
  it('excludes unsummarized and 低 articles and applies the limit', () => {
    const all = [
      article('blank', { summaryJa: '' }),
      article('low', { importance: '低' }),
      article('h', { importance: '高' }),
      article('m1'),
      article('m2', { publishedAt: '2026-10-01T00:00:00.000Z' }),
    ];
    expect(selectDigestCandidates(all, 3).map((a) => a.id)).toEqual(['h', 'm1', 'm2']);
    expect(selectDigestCandidates(all, 2).map((a) => a.id)).toEqual(['h', 'm1']);
  });
});

describe('assembleDigest', () => {
  const now = new Date('2026-11-07T23:30:00.000Z');
  const h = (url: string) => ({ title: 't', summaryJa: 's', url });

  it('stamps date and generatedAt from now', () => {
    const d = assembleDigest({ overviewJa: '概要', sections: [] }, now);
    expect(d).toEqual({ date: '2026-11-07', generatedAt: now.toISOString(), overviewJa: '概要', sections: [] });
  });

  it('drops non-http(s) URLs, caps highlights at five and removes emptied sections', () => {
    const d = assembleDigest(
      {
        overviewJa: '概要',
        sections: [
          {
            category: 'ai',
            highlights: [
              h('javascript:alert(1)'),
              ...Array.from({ length: 6 }, (_, i) => h(`https://e.com/${i}`)),
            ],
          },
          { category: 'security', highlights: [h('ftp://e.com/x')] },
        ],
      },
      now,
    );
    expect(d.sections).toHaveLength(1);
    expect(d.sections[0]!.category).toBe('ai');
    expect(d.sections[0]!.highlights.map((x) => x.url)).toEqual([0, 1, 2, 3, 4].map((i) => `https://e.com/${i}`));
  });
});

describe('listDigestDates', () => {
  const withDir = (fn: (dir: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), 'digest-dates-'));
    try {
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('is empty when digest/ does not exist', () => {
    withDir((dir) => expect(listDigestDates(dir)).toEqual([]));
  });

  it('lists dated files newest first, merges the pending date and ignores other files', () => {
    withDir((dir) => {
      mkdirSync(join(dir, 'digest'));
      for (const f of ['2026-11-05.json', '2026-11-06.json', 'index.json', 'notes.txt']) {
        writeFileSync(join(dir, 'digest', f), '{}');
      }
      expect(listDigestDates(dir, '2026-11-07')).toEqual(['2026-11-07', '2026-11-06', '2026-11-05']);
      expect(listDigestDates(dir, '2026-11-06')).toEqual(['2026-11-06', '2026-11-05']);
    });
  });
});

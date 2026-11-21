import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson } from '../../collector/core/io';
import { readLegacyJson } from './legacy-data.testutil';
import { CategorySummaryFileSchema, IdeaSchema, IdeasFileSchema, IssuesFileSchema } from './issue';

describe('issue schema against legacy data', () => {
  it('parses issues.json', () => {
    expect(IssuesFileSchema.safeParse(readLegacyJson('issue', 'issues.json')).success).toBe(true);
  });

  it('parses ideas.json', () => {
    expect(IdeasFileSchema.safeParse(readLegacyJson('issue', 'ideas.json')).success).toBe(true);
  });

  it('parses category-summary.json', () => {
    expect(CategorySummaryFileSchema.safeParse(readLegacyJson('issue', 'category-summary.json')).success).toBe(true);
  });

  it('requires ideas to clear the appifiability threshold and have ideaGeneratedAt', () => {
    const [issue] = IssuesFileSchema.parse(readLegacyJson('issue', 'issues.json'));
    expect(issue).toBeDefined();
    expect(IdeaSchema.safeParse(issue).success).toBe(false);
    expect(IdeaSchema.safeParse({ ...issue, appifiabilityScore: 70, ideaGeneratedAt: '2026-01-01T00:00:00.000Z' }).success).toBe(true);
  });
});

describe('issue schema defaults for records without idea fields', () => {
  const [base] = IssuesFileSchema.parse(readLegacyJson('issue', 'issues.json'));
  const {
    proposedAppIdea: _a,
    mvpFeatures: _b,
    targetUsers: _c,
    difficulty: _d,
    ideaGeneratedAt: _e,
    ...withoutIdeaFields
  } = base!;
  const legacyDefaults = { proposedAppIdea: '', mvpFeatures: [], targetUsers: '', difficulty: '', ideaGeneratedAt: null };

  it('fills the defaults when all five idea fields are missing', () => {
    expect(IssuesFileSchema.parse([withoutIdeaFields])).toEqual([{ ...withoutIdeaFields, ...legacyDefaults }]);
  });

  it('keeps the values of a record that has them', () => {
    const filled = {
      ...withoutIdeaFields,
      proposedAppIdea: 'idea',
      mvpFeatures: ['a', 'b'],
      targetUsers: 'users',
      difficulty: 'medium',
      ideaGeneratedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(IssuesFileSchema.parse([filled])).toEqual([filled]);
  });

  it('fills the defaults when read through readJson', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sophon-issue-'));
    try {
      writeFileSync(join(dir, 'issues.json'), JSON.stringify([withoutIdeaFields]));
      expect(readJson(dir, 'issues.json', IssuesFileSchema, [])).toEqual([{ ...withoutIdeaFields, ...legacyDefaults }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

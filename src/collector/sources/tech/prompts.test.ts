import { describe, expect, it } from 'vitest';
import { SUMMARY_SYSTEM } from './prompts';

describe('SUMMARY_SYSTEM', () => {
  it('classifies vulnerability articles as security regardless of the hint', () => {
    expect(SUMMARY_SYSTEM).toContain('hint が release や trend でも');
    expect(SUMMARY_SYSTEM).toContain('Node.js のセキュリティリリース');
  });

  it('defines the importance levels with security criteria', () => {
    for (const phrase of ['CISA KEV', 'CVSS 9.0 以上', 'ゼロデイ', '認証回避', '一般的な脆弱性修正のアドバイザリ', 'インシデントの報道', '注意喚起のみ']) {
      expect(SUMMARY_SYSTEM).toContain(phrase);
    }
  });

  it('keeps the response shape and the untrusted-input notice', () => {
    expect(SUMMARY_SYSTEM).toContain('{"results":[');
    expect(SUMMARY_SYSTEM).toContain('items など別の階層を挟まない');
    expect(SUMMARY_SYSTEM).toContain('信頼できないデータ');
  });
});

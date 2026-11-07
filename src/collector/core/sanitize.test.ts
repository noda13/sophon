import { describe, expect, it } from 'vitest';
import { HttpStatusError } from './rss';
import { MAX_ERROR_LENGTH, sanitizeError } from './sanitize';

describe('sanitizeError', () => {
  it('replaces every occurrence of a secret value', () => {
    const env = { GROQ_API_KEY: 'gsk_abcdef123456', GEMINI_API_KEY: 'AIzaSyXYZ-987' };
    expect(sanitizeError('bad key gsk_abcdef123456, retry gsk_abcdef123456 or AIzaSyXYZ-987', env)).toBe(
      'bad key ***, retry *** or ***',
    );
  });

  it('masks J-Quants and RSSHub values too', () => {
    const env = { JQUANTS_API_KEY: 'jq-secret-key', RSSHUB_URL: 'rsshub-internal' };
    expect(sanitizeError('jq-secret-key / rsshub-internal', env)).toBe('*** / ***');
  });

  it('ignores empty and too short secrets', () => {
    const env = { GROQ_API_KEY: '', GEMINI_API_KEY: 'abc', JQUANTS_API_KEY: undefined };
    expect(sanitizeError('abc and stay', env)).toBe('abc and stay');
  });

  it('drops host and path from URLs', () => {
    expect(sanitizeError('HTTP 503 for https://example.com/feed.xml?token=1 (retry)')).toBe('HTTP 503 for <url> (retry)');
    expect(sanitizeError('http://10.0.0.1:1200/twitter/user/x failed')).toBe('<url> failed');
  });

  it('flattens newlines', () => {
    expect(sanitizeError('line1\nline2\r\n  line3')).toBe('line1 line2 line3');
  });

  it('truncates to the length limit', () => {
    const out = sanitizeError('x'.repeat(500));
    expect(out).toHaveLength(MAX_ERROR_LENGTH);
    expect(out.endsWith('…')).toBe(true);
  });

  it('keeps short messages untouched', () => {
    expect(sanitizeError('RSS failed: feed-gone')).toBe('RSS failed: feed-gone');
  });

  it('removes RSSHUB_URL from an HttpStatusError message', () => {
    const rsshub = 'https://rsshub.internal.example:1200';
    const err = new HttpStatusError(503, `${rsshub}/twitter/user/jijicom`);
    const out = sanitizeError(`All 1 RSS sources failed: ${err.message}`, { RSSHUB_URL: rsshub });
    expect(out).toBe('All 1 RSS sources failed: HTTP 503 for <url>');
    expect(out).not.toContain('rsshub.internal');
  });

  it('removes RSSHUB_URL even when the secret is only a host', () => {
    const err = new HttpStatusError(503, 'https://rsshub.internal.example/twitter/user/jijicom');
    expect(sanitizeError(err.message, { RSSHUB_URL: 'rsshub.internal.example' })).toBe('HTTP 503 for <url>');
  });
});

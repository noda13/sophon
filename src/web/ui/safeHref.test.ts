import { describe, expect, it } from 'vitest';
import { safeHref } from './safeHref';

describe('safeHref', () => {
  it.each([
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['http://example.com', 'http://example.com'],
    ['HTTPS://EXAMPLE.COM', 'HTTPS://EXAMPLE.COM'],
    ['  https://example.com  ', 'https://example.com'],
    ['javascript:alert(1)', '#'],
    ['JaVaScRiPt:alert(1)', '#'],
    ['  javascript:alert(1)', '#'],
    ['data:text/html,<script>alert(1)</script>', '#'],
    ['vbscript:msgbox(1)', '#'],
    ['//evil.example.com', '#'],
    ['/relative/path', '#'],
    ['relative/path', '#'],
    ['', '#'],
    ['   ', '#'],
  ])('%j -> %j', (input, expected) => {
    expect(safeHref(input)).toBe(expected);
  });

  it('null と undefined は # を返す', () => {
    expect(safeHref(null)).toBe('#');
    expect(safeHref(undefined)).toBe('#');
  });
});

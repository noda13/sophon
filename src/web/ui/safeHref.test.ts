import { describe, expect, it } from 'vitest';
import { safeHref } from './safeHref';

describe('safeHref', () => {
  it.each([
    ['https://example.com/a?b=1', 'https://example.com/a?b=1'],
    ['http://example.com', 'http://example.com/'],
    ['HTTPS://EXAMPLE.COM', 'https://example.com/'],
    ['  https://example.com  ', 'https://example.com/'],
    ['javascript:alert(1)', null],
    ['JaVaScRiPt:alert(1)', null],
    ['  javascript:alert(1)', null],
    ['data:text/html,<script>alert(1)</script>', null],
    ['vbscript:msgbox(1)', null],
    ['file:///etc/passwd', null],
    ['http://', null],
    ['https://', null],
    ['//evil.example.com', null],
    ['/relative/path', null],
    ['relative/path', null],
    ['', null],
    ['   ', null],
  ])('%j -> %j', (input, expected) => {
    expect(safeHref(input)).toBe(expected);
  });

  it('null と undefined は null を返す', () => {
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });
});

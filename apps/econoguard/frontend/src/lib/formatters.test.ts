import { describe, expect, it } from 'vitest';
import { formatChange, formatNumber, safeHttpUrl } from './formatters';

describe('formatChange', () => {
  it('returns null when there is no previous value', () => {
    expect(formatChange(100, null)).toBeNull();
  });

  it('returns null when the previous value is 0 or -0', () => {
    expect(formatChange(100, 0)).toBeNull();
    expect(formatChange(100, -0)).toBeNull();
  });

  it('formats a rise with a plus sign and direction up', () => {
    expect(formatChange(110, 100)).toEqual({ text: '+10.00%', direction: 'up' });
  });

  it('formats a fall with a minus sign and direction down', () => {
    expect(formatChange(90, 100)).toEqual({ text: '-10.00%', direction: 'down' });
    expect(formatChange(0, 5)).toEqual({ text: '-100.00%', direction: 'down' });
  });

  it('formats no change without a sign and with direction flat', () => {
    expect(formatChange(100, 100)).toEqual({ text: '0.00%', direction: 'flat' });
  });

  it('rounds the percentage to two decimals', () => {
    expect(formatChange(100.126, 100)?.text).toBe('+0.13%');
    expect(formatChange(100.124, 100)?.text).toBe('+0.12%');
    expect(formatChange(99.874, 100)?.text).toBe('-0.13%');
    expect(formatChange(103, 3)?.text).toBe('+3333.33%');
  });

  it('bases the percentage on the previous value', () => {
    expect(formatChange(150, 100)?.text).toBe('+50.00%');
    expect(formatChange(100, 150)?.text).toBe('-33.33%');
  });

  it('treats a rise from a negative previous value as up with a plus sign', () => {
    expect(formatChange(-90, -100)).toEqual({ text: '+10.00%', direction: 'up' });
  });

  it('treats a fall from a negative previous value as down with a minus sign', () => {
    expect(formatChange(-110, -100)).toEqual({ text: '-10.00%', direction: 'down' });
  });

  it('bases the percentage on the magnitude of a negative previous value', () => {
    expect(formatChange(100, -100)).toEqual({ text: '+200.00%', direction: 'up' });
    expect(formatChange(-300, -100)).toEqual({ text: '-200.00%', direction: 'down' });
    expect(formatChange(-100, -100)).toEqual({ text: '0.00%', direction: 'flat' });
  });

  it('takes the direction from the raw difference, not from the rounded text', () => {
    expect(formatChange(100.004, 100)).toEqual({ text: '+0.00%', direction: 'up' });
    expect(formatChange(99.996, 100)?.direction).toBe('down');
  });

  it('returns null when the ratio overflows to Infinity', () => {
    expect(formatChange(1, Number.MIN_VALUE)).toBeNull();
  });

  it('returns null for non-finite input', () => {
    expect(formatChange(Number.NaN, 100)).toBeNull();
    expect(formatChange(Number.POSITIVE_INFINITY, 100)).toBeNull();
    expect(formatChange(Number.NEGATIVE_INFINITY, 100)).toBeNull();
    expect(formatChange(100, Number.NaN)).toBeNull();
    expect(formatChange(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('safeHttpUrl', () => {
  it.each([
    'http://example.com',
    'https://example.com',
    'https://example.com/path?q=1&r=2#frag',
    'http://localhost:3000/a',
    'HTTPS://EXAMPLE.COM/UPPER',
  ])('returns %s unchanged', (url) => {
    expect(safeHttpUrl(url)).toBe(url);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'blob:https://example.com/00000000-0000-0000-0000-000000000000',
    'mailto:someone@example.com',
  ])('rejects the non-http scheme in %j', (url) => {
    expect(safeHttpUrl(url)).toBeUndefined();
  });

  it.each([
    [' https://example.com/a', 'https://example.com/a'],
    ['https://example.com/a  ', 'https://example.com/a'],
    ['\n\thttp://example.com\n', 'http://example.com'],
  ])('returns the trimmed URL for the padded input %j', (input, expected) => {
    expect(safeHttpUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'garbage', 'example.com', '//example.com/path', '/relative/path', 'http//missing-colon'])(
    'rejects the unparsable or relative input %j',
    (url) => {
      expect(safeHttpUrl(url)).toBeUndefined();
    },
  );
});

describe('formatNumber', () => {
  it('uses two decimals by default', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
    expect(formatNumber(0)).toBe('0.00');
  });

  it('groups thousands with commas', () => {
    expect(formatNumber(1234567.891)).toBe('1,234,567.89');
    expect(formatNumber(999.99)).toBe('999.99');
  });

  it('uses exactly the requested number of decimals', () => {
    expect(formatNumber(1234.5, 0)).toBe('1,235');
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
    expect(formatNumber(1234.5, 3)).toBe('1,234.500');
  });

  it('rounds to the requested decimals', () => {
    expect(formatNumber(0.126)).toBe('0.13');
    expect(formatNumber(0.124)).toBe('0.12');
    expect(formatNumber(2.6, 0)).toBe('3');
  });

  it('keeps the sign of negative numbers', () => {
    expect(formatNumber(-1234.5)).toBe('-1,234.50');
  });
});

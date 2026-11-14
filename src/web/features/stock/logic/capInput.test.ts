import { describe, expect, it } from 'vitest';
import { parseCap, validateCapInputs } from './capInput';

describe('parseCap', () => {
  it('空欄と空白だけは undefined（絞り込みなし）', () => {
    expect(parseCap('')).toBeUndefined();
    expect(parseCap('   ')).toBeUndefined();
  });

  it('0 以上の数値を返す。入力途中の "1." も数値として読む', () => {
    expect(parseCap('0')).toBe(0);
    expect(parseCap(' 12.5 ')).toBe(12.5);
    expect(parseCap('1.')).toBe(1);
  });

  it('NaN になる文字列、負数、無限大は null', () => {
    expect(parseCap('abc')).toBeNull();
    expect(parseCap('-1')).toBeNull();
    expect(parseCap('Infinity')).toBeNull();
  });
});

describe('validateCapInputs', () => {
  const ok = { minInvalid: false, maxInvalid: false, reversed: false };

  it('両方空、または片方だけ入力なら問題なし', () => {
    expect(validateCapInputs('', '')).toEqual(ok);
    expect(validateCapInputs('100', '')).toEqual(ok);
    expect(validateCapInputs('', '100')).toEqual(ok);
  });

  it('解釈できない側だけ invalid にする', () => {
    expect(validateCapInputs('abc', '')).toEqual({ ...ok, minInvalid: true });
    expect(validateCapInputs('', '-1')).toEqual({ ...ok, maxInvalid: true });
    expect(validateCapInputs('abc', 'x')).toEqual({ ...ok, minInvalid: true, maxInvalid: true });
  });

  it('下限が上限を超えたときだけ reversed', () => {
    expect(validateCapInputs('200', '100')).toEqual({ ...ok, reversed: true });
    expect(validateCapInputs('100', '100')).toEqual(ok);
    expect(validateCapInputs('100', '200')).toEqual(ok);
    expect(validateCapInputs('1.', '0.5')).toEqual({ ...ok, reversed: true });
  });

  it('片方が解釈できないときは逆転を判定しない', () => {
    expect(validateCapInputs('abc', '100')).toEqual({ ...ok, minInvalid: true });
    expect(validateCapInputs('200', 'abc')).toEqual({ ...ok, maxInvalid: true });
  });
});

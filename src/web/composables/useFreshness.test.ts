import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Meta } from '../../shared/schema/meta';
import { computeFreshness, useFreshness } from './useFreshness';

const HOUR = 3_600_000;
const now = Date.parse('2026-11-07T12:00:00Z');
const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR).toISOString();

function meta(generatedAt: string, run: Partial<Meta['run']> = {}): Meta {
  return { source: 'tech', generatedAt, run: { status: 'ok', counts: {}, errors: [], ...run } };
}

describe('computeFreshness', () => {
  it('新しいデータは古くない', () => {
    const f = computeFreshness(meta(at(1)), { now });
    expect(f.isStale).toBe(false);
    expect(f.ageHours).toBeCloseTo(1);
    expect(f.health).toBe('ok');
    expect(f.generatedAt?.toISOString()).toBe(at(1));
  });

  it('36 時間ちょうどはまだ古くなく、超えると古い', () => {
    expect(computeFreshness(meta(at(36)), { now }).isStale).toBe(false);
    expect(computeFreshness(meta(at(36.01)), { now }).isStale).toBe(true);
  });

  it('staleAfterHours を変えられる', () => {
    expect(computeFreshness(meta(at(7)), { now, staleAfterHours: 6 }).isStale).toBe(true);
  });

  it('now には Date も渡せる', () => {
    expect(computeFreshness(meta(at(40)), { now: new Date(now) }).isStale).toBe(true);
  });

  it('run の status と errors をそのまま返す', () => {
    const f = computeFreshness(meta(at(1), { status: 'partial', errors: ['RSS failed: a'] }), { now });
    expect(f.health).toBe('partial');
    expect(f.errors).toEqual(['RSS failed: a']);
  });

  it('meta がなければ unknown で、古いとは判定しない', () => {
    expect(computeFreshness(undefined, { now })).toMatchObject({
      generatedAt: null,
      ageHours: null,
      isStale: false,
      health: 'unknown',
      errors: [],
    });
  });

  it('旧形式（stock の generatedAt のみ）を読める', () => {
    const f = computeFreshness({ generatedAt: at(2), provider: 'jquants', stockCount: 3 }, { now });
    expect(f.health).toBe('ok');
    expect(f.ageHours).toBeCloseTo(2);
  });

  it('旧形式（econ の lastRun）から partial と errors を導く', () => {
    const f = computeFreshness(
      {
        lastCollectedAt: at(3),
        lastRun: {
          sources: { total: 5, failed: ['feedA'] },
          summaries: { attempted: 10, failed: 0 },
          assessment: 'ok',
        },
      },
      { now },
    );
    expect(f.health).toBe('partial');
    expect(f.errors).toEqual(['RSS failed: feedA']);
  });

  it('旧形式で日時がどのフィールドにもなければ unknown', () => {
    expect(computeFreshness({ provider: 'x' }, { now }).health).toBe('unknown');
  });

  it('日時が不正なら unknown の鮮度で、health と errors は残す', () => {
    const f = computeFreshness(meta('not-a-date', { status: 'failed', errors: ['x'] }), { now });
    expect(f).toMatchObject({ generatedAt: null, isStale: false, health: 'failed', errors: ['x'] });
  });

  it('未来の日時でも ageHours は負にならない', () => {
    expect(computeFreshness(meta(at(-5)), { now }).ageHours).toBe(0);
  });
});

describe('useFreshness', () => {
  it('同じ入力なら同じ結果の参照を返す', () => {
    const m = meta(at(1));
    const { result, rerender } = renderHook(() => useFreshness(m, { now }));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('meta が変わると再計算する', () => {
    const { result, rerender } = renderHook(({ m }) => useFreshness(m, { now }), {
      initialProps: { m: meta(at(1)) },
    });
    expect(result.current.isStale).toBe(false);
    rerender({ m: meta(at(48)) });
    expect(result.current.isStale).toBe(true);
  });
});

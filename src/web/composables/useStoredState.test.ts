import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useStoredState } from './useStoredState';

const Schema = z.object({ age: z.number(), name: z.string() });
const initial = { age: 0, name: '' };

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useStoredState', () => {
  it('保存された値がなければ初期値を返す', () => {
    const { result } = renderHook(() => useStoredState('k1', Schema, initial));
    expect(result.current[0]).toEqual(initial);
  });

  it('保存された正しい値を読む', () => {
    window.localStorage.setItem('k2', JSON.stringify({ age: 30, name: 'a' }));
    const { result } = renderHook(() => useStoredState('k2', Schema, initial));
    expect(result.current[0]).toEqual({ age: 30, name: 'a' });
  });

  it('set で localStorage に書き、更新関数も使える', () => {
    const { result } = renderHook(() => useStoredState('k3', Schema, initial));
    act(() => result.current[1]({ age: 1, name: 'x' }));
    expect(result.current[0]).toEqual({ age: 1, name: 'x' });
    expect(JSON.parse(window.localStorage.getItem('k3') ?? 'null')).toEqual({ age: 1, name: 'x' });

    act(() => result.current[1]((prev) => ({ ...prev, age: prev.age + 1 })));
    expect(result.current[0].age).toBe(2);
  });

  it('reset で削除して初期値に戻る', () => {
    const { result } = renderHook(() => useStoredState('k4', Schema, initial));
    act(() => result.current[1]({ age: 5, name: 'y' }));
    act(() => result.current[2]());
    expect(result.current[0]).toEqual(initial);
    expect(window.localStorage.getItem('k4')).toBeNull();
  });

  it('JSON として壊れた値は初期値に戻す', () => {
    window.localStorage.setItem('k5', '{not json');
    const { result } = renderHook(() => useStoredState('k5', Schema, initial));
    expect(result.current[0]).toEqual(initial);
  });

  it('スキーマに合わない値は初期値に戻す', () => {
    window.localStorage.setItem('k6', JSON.stringify({ age: 'x', name: 1 }));
    const { result } = renderHook(() => useStoredState('k6', Schema, initial));
    expect(result.current[0]).toEqual(initial);
  });

  it('別タブの storage イベントに追従する', () => {
    const { result } = renderHook(() => useStoredState('k7', Schema, initial));
    act(() => {
      window.localStorage.setItem('k7', JSON.stringify({ age: 9, name: 'other' }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'k7' }));
    });
    expect(result.current[0]).toEqual({ age: 9, name: 'other' });
  });

  it('別のキーの storage イベントでは再描画しない', () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useStoredState('k8', Schema, initial);
    });
    const before = renders;
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }));
    });
    expect(renders).toBe(before);
  });

  it('同じキーを使うフック同士が同期する', () => {
    const a = renderHook(() => useStoredState('k9', Schema, initial));
    const b = renderHook(() => useStoredState('k9', Schema, initial));
    act(() => a.result.current[1]({ age: 4, name: 'z' }));
    expect(b.result.current[0]).toEqual({ age: 4, name: 'z' });
  });

  it('getItem が throw しても初期値で動く', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { result } = renderHook(() => useStoredState('k10', Schema, initial));
    expect(result.current[0]).toEqual(initial);
  });

  it('setItem が throw しても同じタブ内では値が保持される', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useStoredState('k11', Schema, initial));
    act(() => result.current[1]({ age: 7, name: 'mem' }));
    expect(result.current[0]).toEqual({ age: 7, name: 'mem' });
    act(() => result.current[2]());
    expect(result.current[0]).toEqual(initial);
  });
});

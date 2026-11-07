import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import type { z } from 'zod';

// localStorage が使えない環境（private window、容量超過、権限拒否）でも同じタブ内では状態が動くように、
// 書き込みに失敗した値はメモリに退避する
const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function readRaw(key: string): string | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) return raw;
  } catch {
    // アクセス不可はメモリの値にフォールバックする
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, raw: string | null): void {
  memory.delete(key);
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  } catch {
    if (raw !== null) memory.set(key, raw);
  }
  for (const listener of listeners.get(key) ?? []) listener();
}

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);

  const onStorage = (event: StorageEvent) => {
    // key が null のときは clear() による全削除
    if (event.key === key || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    set.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function parseRaw<S extends z.ZodType>(raw: string | null, schema: S): z.output<S> | undefined {
  if (raw === null) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function useStoredState<S extends z.ZodType>(
  key: string,
  schema: S,
  initial: z.output<S>,
): readonly [
  value: z.output<S>,
  setValue: (next: z.output<S> | ((prev: z.output<S>) => z.output<S>)) => void,
  reset: () => void,
] {
  // 呼び出し側がリテラルを渡しても参照が変わらないよう、最初の値を保持する
  const initialRef = useRef(initial);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  const raw = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    () => readRaw(key),
    () => null,
  );

  const value = useMemo(
    () => parseRaw(raw, schemaRef.current) ?? initialRef.current,
    [raw],
  );

  const setValue = useCallback(
    (next: z.output<S> | ((prev: z.output<S>) => z.output<S>)) => {
      const prev = parseRaw(readRaw(key), schemaRef.current) ?? initialRef.current;
      const resolved = typeof next === 'function' ? (next as (p: z.output<S>) => z.output<S>)(prev) : next;
      writeRaw(key, JSON.stringify(resolved));
    },
    [key],
  );

  const reset = useCallback(() => writeRaw(key, null), [key]);

  return [value, setValue, reset] as const;
}

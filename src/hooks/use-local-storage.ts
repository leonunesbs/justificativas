'use client';

import { useEffect, useRef, useState } from 'react';

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

/**
 * Persisted state backed by `localStorage`.
 *
 * - SSR-safe: starts from `initialValue` on the server and hydrates from storage
 *   after mount, avoiding hydration mismatches.
 * - Auto-persists every change (no manual `setItem` calls to forget).
 * - `deserialize` lets callers validate/migrate stored data (e.g. with a zod schema)
 *   instead of blindly trusting `JSON.parse`.
 *
 * Returns `[value, setValue, hydrated]`.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  deserialize: (raw: string) => T = (raw) => JSON.parse(raw) as T,
): [T, SetValue<T>, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Keep the latest deserializer without making the hydration effect depend on it.
  const deserializeRef = useRef(deserialize);
  deserializeRef.current = deserialize;

  // Hydrate once on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setValue(deserializeRef.current(raw));
      }
    } catch (error) {
      console.error(`useLocalStorage: failed to read "${key}"`, error);
    } finally {
      setHydrated(true);
    }
  }, [key]);

  // Persist on change — but only after hydration, so we never clobber stored data
  // with the initial value during the first commit.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`useLocalStorage: failed to persist "${key}"`, error);
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated];
}

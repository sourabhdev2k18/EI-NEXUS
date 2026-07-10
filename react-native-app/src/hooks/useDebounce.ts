import { useEffect, useState } from 'react';

// RN has no `window`; setTimeout/clearTimeout are global functions provided
// by the JS runtime (Hermes/JSC), so we just drop the `window.` prefix.
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debouncedValue;
}

import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delay: number | null, immediate = false): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return undefined;
    if (immediate) callbackRef.current();
    const id = setInterval(() => callbackRef.current(), delay);
    return () => clearInterval(id);
  }, [delay, immediate]);
}

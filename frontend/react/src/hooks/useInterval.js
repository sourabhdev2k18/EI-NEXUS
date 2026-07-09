import { useEffect, useRef } from 'react';

export function useInterval(callback, delay, immediate = false) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return undefined;
    if (immediate) callbackRef.current();
    const id = window.setInterval(() => callbackRef.current(), delay);
    return () => window.clearInterval(id);
  }, [delay, immediate]);
}

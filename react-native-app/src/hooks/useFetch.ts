import { useCallback, useEffect, useState } from 'react';

interface UseFetchOptions {
  immediate?: boolean;
}

export function useFetch<T>(fetcher: (...args: any[]) => Promise<T>, { immediate = true }: UseFetchOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(immediate);

  const run = useCallback(
    async (...args: any[]) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcher(...args);
        setData(result);
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetcher]
  );

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, run]);

  return { data, error, loading, run };
}

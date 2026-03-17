"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface AsyncDataOptions<T> {
  /** Function that fetches the data */
  fetcher: () => Promise<T>;
  /** Initial value before first fetch */
  initialData?: T;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Dependencies that trigger refetch */
  deps?: unknown[];
}

interface AsyncDataResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * Generic hook for async data fetching with loading/error states.
 * Replaces the manual useState+useEffect+useCallback pattern repeated across pages.
 *
 * @example
 * const { data: products, loading, refetch } = useAsyncData({
 *   fetcher: () => productService.getAll(),
 *   initialData: [],
 * });
 */
export function useAsyncData<T>(options: AsyncDataOptions<T>): AsyncDataResult<T> {
  const { fetcher, initialData, autoFetch = true, deps = [] } = options;
  const [data, setData] = useState<T>(initialData as T);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mounted.current) setData(result);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher]);

  useEffect(() => {
    mounted.current = true;
    if (autoFetch) refetch();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch, setData };
}

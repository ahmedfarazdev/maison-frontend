import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@/types';

interface UseApiQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * useApiQuery — Compatibility hook that unwraps ApiResponse payloads.
 * This allows page components to access the data directly as they did with tRPC.
 */
export function useApiQuery<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  deps: unknown[] = []
): UseApiQueryResult<T> {
  if (typeof fetcher !== 'function') {
    console.error('useApiQuery was called with an invalid fetcher!', fetcher);
    // Return a dummy result to prevent crash
    return { data: null, isLoading: false, error: 'Invalid fetcher', refetch: () => {} };
  }

  const queryKey = useMemo(() => {
    // Use function source + deps so calls to the same endpoint can share cache across screens.
    const signature = fetcher.toString();
    return ['api-query', signature, ...deps] as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await fetcher();
      return result.data;
    },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch,
  };
}

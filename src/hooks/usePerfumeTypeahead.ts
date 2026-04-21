import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PerfumeSearchResult } from '@/types';

type PerfumeTypeaheadOptions = {
  active?: boolean;
  minChars?: number;
  limit?: number;
  debounceMs?: number;
};

type PerfumeTypeaheadResult = {
  suggestions: PerfumeSearchResult[];
  searchResults: PerfumeSearchResult[];
  isLoadingSuggestions: boolean;
  isSearching: boolean;
  prefetchSuggestions: () => Promise<void>;
};

const DEFAULT_MIN_CHARS = 3;
const DEFAULT_LIMIT = 8;
const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
}

export function usePerfumeTypeahead(query: string, options: PerfumeTypeaheadOptions = {}): PerfumeTypeaheadResult {
  const active = options.active ?? true;
  const minChars = options.minChars ?? DEFAULT_MIN_CHARS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, debounceMs);
  const queryClient = useQueryClient();

  const suggestionsQuery = useQuery({
    queryKey: ['perfumeSuggestions', limit],
    queryFn: () => api.perfumes.suggestions(limit),
    enabled: active && debouncedQuery.length < minChars,
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const searchQuery = useQuery({
    queryKey: ['perfumeSearch', debouncedQuery, limit],
    queryFn: () => api.perfumes.search(debouncedQuery, { limit }),
    enabled: active && debouncedQuery.length >= minChars,
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const prefetchSuggestions = useCallback(() => {
    return queryClient.prefetchQuery({
      queryKey: ['perfumeSuggestions', limit],
      queryFn: () => api.perfumes.suggestions(limit),
      staleTime: DEFAULT_STALE_TIME,
    });
  }, [queryClient, limit]);

  return {
    suggestions: suggestionsQuery.data ?? [],
    searchResults: searchQuery.data ?? [],
    isLoadingSuggestions: suggestionsQuery.isFetching,
    isSearching: searchQuery.isFetching,
    prefetchSuggestions,
  };
}

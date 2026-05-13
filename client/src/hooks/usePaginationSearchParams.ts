import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function usePaginationSearchParams(defaultLimit = 20) {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePositiveInt(searchParams.get('page'), 1);
  const limit = parsePositiveInt(searchParams.get('limit'), defaultLimit);

  const setPagination = useCallback(
    (next: { page?: number; limit?: number }) => {
      const params = new URLSearchParams(searchParams);
      const nextPage = next.page ?? page;
      const nextLimit = next.limit ?? limit;

      if (nextPage <= 1) params.delete('page');
      else params.set('page', String(nextPage));

      if (nextLimit === defaultLimit) params.delete('limit');
      else params.set('limit', String(nextLimit));

      setSearchParams(params);
    },
    [defaultLimit, limit, page, searchParams, setSearchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => setPagination({ page: nextPage }),
    [setPagination],
  );
  const setLimit = useCallback(
    (nextLimit: number) => setPagination({ limit: nextLimit }),
    [setPagination],
  );

  return { page, limit, setPage, setLimit, setPagination, searchParams, setSearchParams };
}

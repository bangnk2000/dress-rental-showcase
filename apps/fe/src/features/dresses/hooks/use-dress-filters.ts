/**
 * Catalog filter state lives in the URL (q / status / page) so filtered views
 * are linkable and back/forward works. This hook is the single reader/writer
 * of those search params and derives the params object for the generated list
 * hook — each combination caches under its own generated query key.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { ListDressesHttpControllerListStatus } from '@/api/generated/model';
import type { ListDressesHttpControllerListParams } from '@/api/generated/model';

function parseStatus(raw: string | null): ListDressesHttpControllerListStatus | undefined {
  if (raw === null) return undefined;
  return Object.values(ListDressesHttpControllerListStatus).find((value) => value === raw);
}

function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function useDressFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q')?.trim() || undefined;
  const status = parseStatus(searchParams.get('status'));
  const categoryId = searchParams.get('categoryId') || undefined;
  const page = parsePage(searchParams.get('page'));

  const listParams = useMemo<ListDressesHttpControllerListParams>(
    () => ({
      ...(q !== undefined ? { q } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(page > 1 ? { page } : {}),
    }),
    [q, status, categoryId, page],
  );

  /** Changing the search resets pagination. */
  const setSearch = useCallback(
    (next: string) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        const trimmed = next.trim();
        if (trimmed) params.set('q', trimmed);
        else params.delete('q');
        params.delete('page');
        return params;
      });
    },
    [setSearchParams],
  );

  /** Changing the status filter resets pagination. */
  const setStatus = useCallback(
    (next: ListDressesHttpControllerListStatus | undefined) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set('status', next);
        else params.delete('status');
        params.delete('page');
        return params;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (next: number) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (next > 1) params.set('page', String(next));
        else params.delete('page');
        return params;
      });
    },
    [setSearchParams],
  );

  /** Changing the category filter resets pagination (FR-CAT-07). */
  const setCategoryId = useCallback(
    (next: string | undefined) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set('categoryId', next);
        else params.delete('categoryId');
        params.delete('page');
        return params;
      });
    },
    [setSearchParams],
  );

  const hasActiveFilters = q !== undefined || status !== undefined || categoryId !== undefined;

  return {
    q,
    status,
    categoryId,
    page,
    listParams,
    hasActiveFilters,
    setSearch,
    setStatus,
    setCategoryId,
    setPage,
  };
}

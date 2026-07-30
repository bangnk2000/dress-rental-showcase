/**
 * Rentals filter state lives in the URL (q / status / page) so filtered views
 * are linkable and back/forward works — same pattern as the dresses list.
 * Single reader/writer of those search params; derives the params object for
 * the generated list hook.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { ListRentalsHttpControllerListStatus } from '@/api/generated/model';
import type { ListRentalsHttpControllerListParams } from '@/api/generated/model';

function parseStatus(raw: string | null): ListRentalsHttpControllerListStatus | undefined {
  if (raw === null) return undefined;
  return Object.values(ListRentalsHttpControllerListStatus).find((value) => value === raw);
}

function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function useRentalFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q')?.trim() || undefined;
  const status = parseStatus(searchParams.get('status'));
  const page = parsePage(searchParams.get('page'));

  const listParams = useMemo<ListRentalsHttpControllerListParams>(
    () => ({
      ...(q !== undefined ? { q } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(page > 1 ? { page } : {}),
    }),
    [q, status, page],
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
    (next: ListRentalsHttpControllerListStatus | undefined) => {
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

  const hasActiveFilters = q !== undefined || status !== undefined;

  return { q, status, page, listParams, hasActiveFilters, setSearch, setStatus, setPage };
}

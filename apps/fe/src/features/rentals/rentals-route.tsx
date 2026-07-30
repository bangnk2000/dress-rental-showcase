import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';

import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useCancelRentalHttpControllerCancel,
  useListRentalsHttpControllerListSuspense,
} from '@/api/generated/rentals/rentals';
import type { RentalListItemDto } from '@/api/generated/model';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

import { RentalFiltersBar } from './components/rental-filters-bar';
import { RentalListPagination } from './components/rental-list-pagination';
import { RentalPaymentsDialog } from './components/rental-payments-dialog';
import { RentalTable } from './components/rental-table';
import { useRentalFilters } from './hooks/use-rental-filters';
import { isConflictError } from './lib/is-conflict-error';

/**
 * Rentals list — the post-create landing. Loading/error surfaces belong to
 * the route boundary (Suspense + error boundary); the suspense list hook
 * means no isPending branching here.
 */
export function RentalsRoute() {
  const { t } = useTranslation('rentals');
  const queryClient = useQueryClient();
  const { q, status, listParams, hasActiveFilters, setSearch, setStatus, setPage } =
    useRentalFilters();
  const { data } = useListRentalsHttpControllerListSuspense(listParams);
  const [paymentsTarget, setPaymentsTarget] = useState<RentalListItemDto | null>(null);

  // Cancel is booked-only on the server (409 otherwise); frees the calendar.
  const cancelRental = useCancelRentalHttpControllerCancel<unknown>({
    mutation: {
      onSuccess: async () => {
        // Parameterless keys prefix every filtered list / dated board query.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getListRentalsHttpControllerListQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getGetTodayBoardHttpControllerGetQueryKey(),
          }),
        ]);
        toast.success(t('cancel.success'));
      },
      onError: (error) => {
        toast.error(
          isConflictError(error) ? t('cancel.alreadyProcessed') : t('cancel.error'),
        );
      },
    },
  });

  const totalPages = data.limit > 0 ? Math.max(1, Math.ceil(data.count / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild>
            <Link to="/rentals/new">{t('newTitle')}</Link>
          </Button>
        }
      />
      <div className="space-y-4">
        <RentalFiltersBar
          q={q}
          status={status}
          onSearch={setSearch}
          onStatusChange={setStatus}
        />
        {data.count === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              title={t('list.empty.noMatch')}
              description={t('list.empty.noMatchHint')}
            />
          ) : (
            <EmptyState
              title={t('list.empty.noRentals')}
              description={t('list.empty.noRentalsHint')}
              action={
                <Button asChild>
                  <Link to="/rentals/new">{t('newTitle')}</Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <RentalTable
              rentals={data.data}
              onCancel={(rental) => {
                if (window.confirm(t('cancel.confirm'))) {
                  cancelRental.mutate({ id: rental.rentalId });
                }
              }}
              onShowPayments={setPaymentsTarget}
            />
            {totalPages > 1 ? (
              <RentalListPagination
                page={data.page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
      <RentalPaymentsDialog rental={paymentsTarget} onClose={() => setPaymentsTarget(null)} />
    </>
  );
}

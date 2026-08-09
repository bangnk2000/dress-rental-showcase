import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useCancelRentalHttpControllerCancel,
  useListRentalsHttpControllerListSuspense,
} from '@/api/generated/rentals/rentals';
import type { RentalListItemDto } from '@/api/generated/model';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

import { RentalFiltersBar } from './components/rental-filters-bar';
import { RentalListPagination } from './components/rental-list-pagination';
import { RentalPaymentsDialog } from './components/rental-payments-dialog';
import { RentalTable } from './components/rental-table';
import { useRentalFilters } from './hooks/use-rental-filters';

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
  const [cancelTarget, setCancelTarget] = useState<RentalListItemDto | null>(null);

  // Cancel is booked-only on the server; frees the calendar.
  const cancelRental = useCancelRentalHttpControllerCancel({
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
      onError: async (error) => {
        // Rejections mean another device moved this rental on: say what state it is in and
        // refresh, instead of one vague "conflict" (ADR 0001 §4).
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome') {
          toast.error(
            mapped.status === 'rejected_cancel_not_allowed'
              ? t('cancel.notAllowed', {
                  status: t(`status.${String(mapped.currentStatus)}`, {
                    defaultValue: String(mapped.currentStatus ?? ''),
                  }),
                })
              : t('errors.rentalNotFound'),
          );
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: getListRentalsHttpControllerListQueryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: getGetTodayBoardHttpControllerGetQueryKey(),
            }),
          ]);
          return;
        }
        toast.error(t('cancel.error'));
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
              onCancel={setCancelTarget}
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
      {/* Cancelling frees the calendar immediately and cannot be undone — the confirmation names
          the customer so a mis-tap on the tablet is caught before, not after. */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title={t('cancel.title')}
        description={
          cancelTarget
            ? t('cancel.confirmFor', { customer: cancelTarget.customerName })
            : undefined
        }
        confirmLabel={t('cancel.confirmAction')}
        destructive
        onConfirm={() => {
          if (cancelTarget) cancelRental.mutate({ id: cancelTarget.rentalId });
          setCancelTarget(null);
        }}
      />
      <RentalPaymentsDialog rental={paymentsTarget} onClose={() => setPaymentsTarget(null)} />
    </>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useCancelRentalHttpControllerCancel,
  useGetTodayBoardHttpControllerGetSuspense,
  usePickupRentalHttpControllerPickup,
} from '@/api/generated/rentals/rentals';
import type { TodayBoardRentalDto } from '@/api/generated/model';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { ReturnRentalDialog } from './components/return-rental-dialog';
import { TodayBoardSection } from './components/today-board-section';
import { localDateIso, shiftDateIso } from './lib/local-date';

/**
 * Buttons on this screen are pressed with a thumb, often while the other hand holds a dress, so
 * the two board actions are sized past the 44px touch guidance rather than at the 32px `sm` the
 * rest of the app uses for secondary actions.
 */
const TOUCH_ACTION = 'h-11 px-5 text-base';

/** The morning screen: what goes out, what comes back, what is late. */
export function TodayRoute() {
  const { t } = useTranslation('today');
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => localDateIso());
  const [returnTarget, setReturnTarget] = useState<TodayBoardRentalDto | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TodayBoardRentalDto | null>(null);
  // A new date suspends the board query. Inside a transition React keeps the current board on
  // screen (dimmed) instead of dropping the whole route to the spinner — this screen is opened
  // dozens of times a day and blanking it for every date step read as a reload.
  const [isSwitchingDate, startDateTransition] = useTransition();
  const { data: board } = useGetTodayBoardHttpControllerGetSuspense({ date });

  const today = localDateIso();
  function goToDate(next: string): void {
    startDateTransition(() => setDate(next));
  }

  /** The board is shared across devices, so a rejection means someone else already acted. */
  async function refreshBoardAndList(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTodayBoardHttpControllerGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListRentalsHttpControllerListQueryKey() }),
    ]);
  }

  const pickupRental = usePickupRentalHttpControllerPickup({
    mutation: {
      onSuccess: async () => {
        // Parameterless keys prefix every dated board / filtered list query —
        // the rentals LIST may still be FRESH (staleTime 60s) and must not
        // keep showing the old status.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getGetTodayBoardHttpControllerGetQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getListRentalsHttpControllerListQueryKey(),
          }),
        ]);
        toast.success(t('pickupSuccess'));
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome') {
          toast.error(
            mapped.status === 'rejected_pickup_not_allowed'
              ? t('errors.pickupNotAllowed', {
                  status: t(`status.${String(mapped.currentStatus)}`, {
                    defaultValue: String(mapped.currentStatus ?? ''),
                  }),
                })
              : t('errors.rentalNotFound'),
          );
          await refreshBoardAndList();
          return;
        }
        toast.error(t('actionError'));
      },
    },
  });

  // The board is the natural place to close a no-show: the card lost its return action
  // (FR-RENT-10) and cancelling is what the shop actually does with a booking nobody collected.
  const cancelRental = useCancelRentalHttpControllerCancel({
    mutation: {
      onSuccess: async () => {
        await refreshBoardAndList();
        toast.success(t('cancel.success'));
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome') {
          toast.error(
            mapped.status === 'rejected_cancel_has_payments'
              ? t('cancel.hasPayments')
              : t('cancel.notAllowed'),
          );
          await refreshBoardAndList();
          return;
        }
        toast.error(t('actionError'));
      },
    },
  });

  /**
   * FR-RENT-10: only an OUT rental can come back. A booked rental on due-back/overdue means the
   * customer never collected — its actions are hand the dresses over late, or close the no-show.
   */
  const returnAction = (rental: TodayBoardRentalDto) =>
    rental.status === 'out' ? (
      <Button
        variant="outline"
        className={TOUCH_ACTION}
        // Repeated verbatim down the list, so the accessible name carries the customer.
        aria-label={t('actions.returnFor', { customer: rental.customerName })}
        onClick={() => setReturnTarget(rental)}
      >
        {t('actions.return')}
      </Button>
    ) : (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('notPickedUp')}</span>
        <Button
          className={TOUCH_ACTION}
          disabled={pickupRental.isPending}
          aria-label={t('actions.pickupFor', { customer: rental.customerName })}
          onClick={() => pickupRental.mutate({ id: rental.rentalId })}
        >
          {t('actions.pickup')}
        </Button>
        <Button
          variant="outline"
          className={TOUCH_ACTION}
          aria-label={t('actions.cancelFor', { customer: rental.customerName })}
          onClick={() => setCancelTarget(rental)}
        >
          {t('actions.cancel')}
        </Button>
      </div>
    );

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('date.previous')}
              onClick={() => goToDate(shiftDateIso(date, -1))}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Input
              type="date"
              aria-label={t('dateLabel')}
              value={date}
              onChange={(event) => {
                // clearing a native date input yields '' — keep the last real date
                if (event.target.value) goToDate(event.target.value);
              }}
              className="w-auto"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label={t('date.next')}
              onClick={() => goToDate(shiftDateIso(date, 1))}
            >
              <ChevronRight aria-hidden />
            </Button>
            {/* Getting back is otherwise "remember what today is, then use the date picker". */}
            <Button
              variant="outline"
              disabled={date === today}
              onClick={() => goToDate(today)}
            >
              {t('date.today')}
            </Button>
          </div>
        }
      />
      <div
        className={cn(
          'grid gap-6 transition-opacity lg:grid-cols-3',
          isSwitchingDate && 'opacity-50',
        )}
      >
        <TodayBoardSection
          title={t('dueOut.title')}
          emptyText={t('dueOut.empty')}
          rentals={board.dueOut}
          renderActions={(rental) => {
            // A rental handed out earlier in the day stays on this list so the day's hand-outs
            // are visible in one place; nothing is left to do on it, so it reads as done.
            if (rental.status === 'out') {
              return (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Check aria-hidden className="size-4" />
                  {t('handedOut')}
                </span>
              );
            }
            // One mutation object serves every row, so `isPending` alone greys out the whole
            // list with no clue which hand-out is in flight. The spinner marks the actual row.
            const inFlight =
              pickupRental.isPending && pickupRental.variables?.id === rental.rentalId;
            return (
              <Button
                className={TOUCH_ACTION}
                disabled={pickupRental.isPending}
                aria-label={t('actions.pickupFor', { customer: rental.customerName })}
                onClick={() => pickupRental.mutate({ id: rental.rentalId })}
              >
                {inFlight ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {t('actions.pickup')}
              </Button>
            );
          }}
        />
        <TodayBoardSection
          title={t('dueBack.title')}
          emptyText={t('dueBack.empty')}
          rentals={board.dueBack}
          renderActions={returnAction}
        />
        <TodayBoardSection
          title={t('overdue.title')}
          emptyText={t('overdue.empty')}
          rentals={board.overdue}
          renderActions={returnAction}
        />
      </div>
      <ReturnRentalDialog rental={returnTarget} onClose={() => setReturnTarget(null)} />
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
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
    </>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useGetTodayBoardHttpControllerGetSuspense,
  usePickupRentalHttpControllerPickup,
} from '@/api/generated/rentals/rentals';
import type { TodayBoardRentalDto } from '@/api/generated/model';
import { useCancelRental } from '@/api/use-cancel-rental';
import { PageHeader } from '@/components/layout/page-header';
import { CancelRentalDialog } from '@/components/rentals/cancel-rental-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { PickupDepositDialog } from './components/pickup-deposit-dialog';
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
  const [depositTarget, setDepositTarget] = useState<TodayBoardRentalDto | null>(null);
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
      onError: async (error, variables) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome' && mapped.status === 'rejected_deposit_not_collected') {
          // The board thought a deposit was on file; the ledger says otherwise (FR-RENT-14).
          // Refresh and ask for the deposit right away instead of a dead-end toast.
          await refreshBoardAndList();
          const rental = [...board.dueOut, ...board.dueBack, ...board.overdue].find(
            (entry) => entry.rentalId === variables.id,
          );
          if (rental) setDepositTarget({ ...rental, depositCollected: 0 });
          return;
        }
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

  const cancelController = useCancelRental(cancelTarget?.rentalId ?? null);

  /**
   * FR-RENT-14 §6.Q3: a booking is handed out only with a deposit on file. With one, the tap
   * hands out straight away as before; without, the deposit dialog collects it with the handover.
   */
  function startPickup(rental: TodayBoardRentalDto): void {
    if (rental.depositCollected > 0) {
      pickupRental.mutate({ id: rental.rentalId, data: {} });
    } else {
      setDepositTarget(rental);
    }
  }

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
      // Phone: the label takes its own line, the two buttons share the next one.
      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <span className="text-sm text-muted-foreground max-sm:basis-full">{t('notPickedUp')}</span>
        <Button
          className={cn(TOUCH_ACTION, 'max-sm:flex-1')}
          disabled={pickupRental.isPending}
          aria-label={t('actions.pickupFor', { customer: rental.customerName })}
          onClick={() => startPickup(rental)}
        >
          {t('actions.pickup')}
        </Button>
        <Button
          variant="outline"
          className={cn(TOUCH_ACTION, 'max-sm:flex-1')}
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
          // Phone: one full-width bar (‹ date › Hôm nay), the date input takes what is left.
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1 sm:flex sm:w-auto">
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
              className="min-w-0 sm:w-auto"
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
                onClick={() => startPickup(rental)}
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
      <PickupDepositDialog rental={depositTarget} onClose={() => setDepositTarget(null)} />
      {/* The board is the natural place to close a no-show: the card lost its return action
          (FR-RENT-10). A prepaid no-show cancels with refunds (rentals/cancel-with-refund). */}
      <CancelRentalDialog
        rental={cancelTarget}
        controller={cancelController}
        onClose={() => setCancelTarget(null)}
      />
    </>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  getGetTodayBoardHttpControllerGetQueryKey,
  useGetTodayBoardHttpControllerGetSuspense,
  usePickupRentalHttpControllerPickup,
} from '@/api/generated/rentals/rentals';
import type { TodayBoardRentalDto } from '@/api/generated/model';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { ReturnRentalDialog } from './components/return-rental-dialog';
import { TodayBoardSection } from './components/today-board-section';
import { isConflictError } from './lib/is-conflict-error';
import { localDateIso } from './lib/local-date';

/** The morning screen: what goes out, what comes back, what is late. */
export function TodayRoute() {
  const { t } = useTranslation('today');
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => localDateIso());
  const [returnTarget, setReturnTarget] = useState<TodayBoardRentalDto | null>(null);
  const { data: board } = useGetTodayBoardHttpControllerGetSuspense({ date });

  const pickupRental = usePickupRentalHttpControllerPickup<unknown>({
    mutation: {
      onSuccess: async () => {
        // The parameterless key prefixes every dated board query.
        await queryClient.invalidateQueries({
          queryKey: getGetTodayBoardHttpControllerGetQueryKey(),
        });
        toast.success(t('pickupSuccess'));
      },
      onError: (error) => {
        toast.error(
          isConflictError(error) ? t('alreadyProcessed') : t('actionError'),
        );
      },
    },
  });

  const returnAction = (rental: TodayBoardRentalDto) => (
    <Button size="sm" variant="outline" onClick={() => setReturnTarget(rental)}>
      {t('actions.return')}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Input
            type="date"
            aria-label={t('dateLabel')}
            value={date}
            onChange={(event) => {
              // clearing a native date input yields '' — keep the last real date
              if (event.target.value) setDate(event.target.value);
            }}
            className="w-auto"
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <TodayBoardSection
          title={t('dueOut.title')}
          emptyText={t('dueOut.empty')}
          rentals={board.dueOut}
          renderActions={(rental) => (
            <Button
              size="sm"
              disabled={pickupRental.isPending}
              onClick={() => pickupRental.mutate({ id: rental.rentalId })}
            >
              {t('actions.pickup')}
            </Button>
          )}
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
    </>
  );
}

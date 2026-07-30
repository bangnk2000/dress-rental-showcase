import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { toast } from 'sonner';

import {
  getGetDressHttpControllerGetQueryKey,
  getListDressesHttpControllerListQueryKey,
  useGetDressHttpControllerGetSuspense,
  useRetireDressHttpControllerRetire,
} from '@/api/generated/catalog/catalog';
import { useListBookedRangesHttpControllerListSuspense } from '@/api/generated/rentals/rentals';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatVnd } from '@/lib/format';

import { AvailabilityChecker } from './components/availability-checker';
import { BookingCalendar } from './components/booking-calendar';
import { DressFormDialog } from './components/dress-form-dialog';
import { DressStatusBadge } from './components/dress-status-badge';
import { isConflictError } from './lib/is-conflict-error';

export function DressDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return id ? <DressDetail dressId={id} /> : null;
}

function DressDetail({ dressId }: { dressId: string }) {
  const { t } = useTranslation('dresses');
  const queryClient = useQueryClient();
  const { data: dress } = useGetDressHttpControllerGetSuspense(dressId);
  const { data: ranges } = useListBookedRangesHttpControllerListSuspense(dressId);
  const [editOpen, setEditOpen] = useState(false);

  // Retire is owner-only on the server (403 for other staff) and one-way in MVP.
  const retireDress = useRetireDressHttpControllerRetire<unknown>({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getListDressesHttpControllerListQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getGetDressHttpControllerGetQueryKey(dressId),
          }),
        ]);
        toast.success(t('detail.retire.success'));
      },
      onError: (error) => {
        toast.error(
          isConflictError(error) ? t('detail.retire.alreadyRetired') : t('detail.retire.error'),
        );
      },
    },
  });

  const info = [
    { label: t('detail.info.size'), value: dress.sizeLabel ?? '—' },
    { label: t('detail.info.rentalPrice'), value: formatVnd(dress.rentalPrice) },
    { label: t('detail.info.deposit'), value: formatVnd(dress.depositAmount) },
    { label: t('detail.info.notes'), value: dress.notes ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title={`${dress.code} — ${dress.name}`}
        actions={
          <div className="flex items-center gap-2">
            <DressStatusBadge status={dress.status} />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              {t('detail.actions.edit')}
            </Button>
            {dress.status === 'active' ? (
              <Button
                variant="destructive"
                disabled={retireDress.isPending}
                onClick={() => {
                  if (window.confirm(t('detail.retire.confirm'))) {
                    retireDress.mutate({ id: dressId });
                  }
                }}
              >
                {t('detail.actions.retire')}
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-sm font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
        {dress.photoUrls.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('detail.photos.title')}</h2>
            <div className="flex flex-wrap gap-2">
              {dress.photoUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={dress.code}
                    loading="lazy"
                    className="h-28 w-28 rounded-md border object-cover"
                  />
                </a>
              ))}
            </div>
          </section>
        ) : null}
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.calendar.title')}</h2>
          {ranges.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('detail.calendar.empty')}</p>
          ) : null}
          <BookingCalendar ranges={ranges.data} />
        </section>
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.checker.title')}</h2>
          <AvailabilityChecker dressId={dressId} />
        </section>
      </div>
      <DressFormDialog open={editOpen} onOpenChange={setEditOpen} dress={dress} />
    </>
  );
}

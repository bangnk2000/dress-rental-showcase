import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { useGetDressHttpControllerGetSuspense } from '@/api/generated/catalog/catalog';
import { useListBookedRangesHttpControllerListSuspense } from '@/api/generated/rentals/rentals';
import { PageHeader } from '@/components/layout/page-header';
import { formatVnd } from '@/lib/format';

import { AvailabilityChecker } from './components/availability-checker';
import { BookingCalendar } from './components/booking-calendar';
import { DressStatusBadge } from './components/dress-status-badge';

export function DressDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return id ? <DressDetail dressId={id} /> : null;
}

function DressDetail({ dressId }: { dressId: string }) {
  const { t } = useTranslation('dresses');
  const { data: dress } = useGetDressHttpControllerGetSuspense(dressId);
  const { data: ranges } = useListBookedRangesHttpControllerListSuspense(dressId);

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
        actions={<DressStatusBadge status={dress.status} />}
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
    </>
  );
}

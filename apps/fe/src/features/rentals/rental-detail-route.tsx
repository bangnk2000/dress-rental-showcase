import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { useMeHttpControllerMeSuspense } from '@/api/generated/identity/identity';
import { useGetRentalHttpControllerGetSuspense } from '@/api/generated/rentals/rentals';
import type { RentalDetailDto } from '@/api/generated/model';
import { useCancelRental } from '@/api/use-cancel-rental';
import { PageHeader } from '@/components/layout/page-header';
import { CancelRentalDialog } from '@/components/rentals/cancel-rental-dialog';
import { Button } from '@/components/ui/button';
import { formatDate, formatVnd } from '@/lib/format';

import { RentalPaymentsDialog } from './components/rental-payments-dialog';
import { RentalStatusBadge } from './components/rental-status-badge';

/** Money can be recorded and content edited only while the rental is running. */
function isOpenRental(status: RentalDetailDto['status']): boolean {
  return status === 'booked' || status === 'out';
}

export function RentalDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return id ? <RentalDetail rentalId={id} /> : null;
}

/**
 * ONE screen for one rental (FR-RENT-12): what was agreed, with whom, for when — and the first
 * place the notes are shown. Actions mirror the list row (money, cancel) plus the owner's edit
 * (FR-RENT-13). Pickup and return stay on the today board, where the settlement dialog lives.
 */
function RentalDetail({ rentalId }: { rentalId: string }) {
  const { t } = useTranslation('rentals');
  const { data: rental } = useGetRentalHttpControllerGetSuspense(rentalId);
  const { data: me } = useMeHttpControllerMeSuspense();
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancelController = useCancelRental(cancelOpen ? rentalId : null);

  const open = isOpenRental(rental.status);
  const subtotal = rental.dresses.reduce((sum, dress) => sum + dress.agreedPrice, 0);
  // Every item blocks the same interval (period + buffer); the latest one is the rental's.
  const blockedUntil = rental.dresses
    .filter((dress) => dress.blocking)
    .reduce<string | null>(
      (latest, dress) =>
        latest === null || dress.blockedUntilDate > latest ? dress.blockedUntilDate : latest,
      null,
    );

  const info = [
    {
      label: t('detail.info.period'),
      value: `${formatDate(rental.startDate)} – ${formatDate(rental.endDate)}`,
    },
    {
      label: t('detail.info.blockedUntil'),
      value: blockedUntil ? formatDate(blockedUntil) : t('detail.info.notBlocking'),
      hint: blockedUntil ? t('detail.info.blockedUntilHint') : undefined,
    },
    { label: t('detail.info.discount'), value: formatVnd(rental.discountAmount) },
    // The arithmetic behind the number staff quote: Σ agreed − discount (deposit is separate).
    {
      label: t('detail.info.expectedFee'),
      value: formatVnd(Math.max(0, subtotal - rental.discountAmount)),
      hint: t('detail.info.expectedFeeHint', {
        subtotal: formatVnd(subtotal),
        discount: formatVnd(rental.discountAmount),
      }),
    },
    { label: t('detail.info.createdAt'), value: formatDate(rental.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title={t('detail.title', { customer: rental.customerName })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RentalStatusBadge status={rental.status} />
            <Button
              variant="outline"
              onClick={() => setPaymentsOpen(true)}
              aria-label={t('list.actions.paymentsFor', { customer: rental.customerName })}
            >
              {t('detail.actions.payments')}
            </Button>
            {/* Editing is owner-only (FR-RENT-13): hiding the button is display — the edit
                route AND the BE policy both re-check. */}
            {open && me.role === 'owner' ? (
              <Button asChild>
                <Link to={`/rentals/${rentalId}/edit`}>{t('detail.actions.edit')}</Link>
              </Button>
            ) : null}
            {open ? (
              <Button
                variant="outline"
                disabled={cancelController.pending}
                onClick={() => setCancelOpen(true)}
              >
                {t('detail.actions.cancel')}
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{t('detail.info.phone')}</dt>
            <dd className="mt-1 text-sm font-medium">
              <a href={`tel:${rental.customerPhone}`}>{rental.customerPhone}</a>
            </dd>
          </div>
          {info.map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">{item.value}</dd>
              {item.hint ? (
                <dd className="mt-1 text-xs text-muted-foreground">{item.hint}</dd>
              ) : null}
            </div>
          ))}
        </dl>
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.dresses.title')}</h2>
          <ul className="divide-y rounded-md border">
            {rental.dresses.map((dress) => (
              <li key={dress.dressId} className="flex items-center justify-between gap-4 p-3">
                <span className="min-w-0 truncate">
                  <Link
                    to={`/dresses/${dress.dressId}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {dress.code}
                  </Link>{' '}
                  <span className="text-muted-foreground">{dress.name}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  <span className="text-muted-foreground">{t('detail.dresses.agreedPrice')} </span>
                  {formatVnd(dress.agreedPrice)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.info.notes')}</h2>
          <p className="text-sm whitespace-pre-line">
            {rental.notes ?? <span className="text-muted-foreground">{t('detail.info.noNotes')}</span>}
          </p>
        </section>
        <Button asChild variant="link" className="px-0">
          <Link to="/rentals">{t('detail.actions.back')}</Link>
        </Button>
      </div>
      {/* Cancelling frees the calendar immediately and cannot be undone — the dialog names the
          customer, and with money on file it asks for the refunds (rentals/cancel-with-refund). */}
      <CancelRentalDialog
        rental={cancelOpen ? rental : null}
        controller={cancelController}
        onClose={() => setCancelOpen(false)}
      />
      <RentalPaymentsDialog
        rental={paymentsOpen ? rental : null}
        onClose={() => setPaymentsOpen(false)}
      />
    </>
  );
}

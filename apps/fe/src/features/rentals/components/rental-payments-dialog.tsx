import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useListPaymentsHttpControllerList } from '@/api/generated/payments/payments';
import { getListRentalsHttpControllerListQueryKey } from '@/api/generated/rentals/rentals';
import type { RentalListItemDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatVnd } from '@/lib/format';

import { RecordCollectionForm } from './record-collection-form';

interface RentalPaymentsDialogProps {
  /** The rental whose money is shown; null = closed. */
  rental: RentalListItemDto | null;
  onClose: () => void;
}

/** Money can still be recorded while the rental is running (FR-PAY-02 R4). */
function isOpenRental(status: RentalListItemDto['status']): boolean {
  return status === 'booked' || status === 'out';
}

/**
 * ONE money screen per rental: what has been recorded, the totals, and — while the rental is
 * open — the form that records what was collected. Reachable from every row of the list, because
 * a deposit is taken long before there is anything to settle.
 */
export function RentalPaymentsDialog({ rental, onClose }: RentalPaymentsDialogProps) {
  const { t } = useTranslation('rentals');
  const { t: tCommon } = useTranslation('common'); // shared verbs only
  const queryClient = useQueryClient();

  // Hooks run unconditionally — the query only fires while the dialog is open.
  const { data, isPending, isError, isFetching, refetch } = useListPaymentsHttpControllerList(
    rental?.rentalId ?? '',
    { query: { enabled: rental !== null } },
  );

  async function refreshRentals(): Promise<void> {
    await queryClient.invalidateQueries({
      queryKey: getListRentalsHttpControllerListQueryKey(),
    });
  }

  const summary = data?.summary ?? null;
  const collected = summary ? summary.deposit + summary.rentalFee : 0;
  // Everything handed back: the deposit (return or cancel) AND the rental fee a cancel refunded
  // (rentals/cancel-with-refund) — leaving the latter out understates refunds on the one screen
  // the shop reconciles against.
  const returnedToCustomer = summary ? summary.depositRefund + summary.rentalFeeRefund : 0;

  return (
    <Dialog open={rental !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('payments.title')}</DialogTitle>
          <DialogDescription>
            {t('payments.description', { customer: rental?.customerName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <p className="text-sm text-muted-foreground">{t('payments.loading')}</p>
        ) : isError ? (
          /* "Could not read the ledger" is not "nothing was recorded". Saying the second when the
             first is true tells staff this rental has taken no money — the one thing this screen
             exists to answer — so the failure states itself and offers a retry. */
          <div className="space-y-2">
            <p className="text-sm text-destructive">{t('payments.unavailable')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {tCommon('actions.retry')}
            </Button>
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <ul className="space-y-2">
              {data.data.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{t(`payments.kinds.${payment.kind}`)}</p>
                    {payment.note ? (
                      <p className="text-sm text-muted-foreground">{payment.note}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatVnd(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
            {/* Totals come from the API, not from summing the list here: one place owns the
                arithmetic that the return dialog also spends. */}
            <dl aria-live="polite" className="grid gap-1 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('payments.totals.collected')}</dt>
                <dd className="font-medium tabular-nums">{formatVnd(collected)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('payments.totals.refunded')}</dt>
                <dd className="font-medium tabular-nums">{formatVnd(returnedToCustomer)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('payments.empty')}</p>
        )}
        {rental && summary && isOpenRental(rental.status) ? (
          <RecordCollectionForm
            rental={rental}
            summary={summary}
            onRentalClosed={async (currentStatus) => {
              toast.error(
                t('collect.rentalClosed', {
                  status: t(`status.${currentStatus}`, { defaultValue: currentStatus }),
                }),
              );
              await refreshRentals();
              onClose();
            }}
            onRentalGone={async () => {
              toast.error(t('errors.rentalNotFound'));
              await refreshRentals();
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

import { useTranslation } from 'react-i18next';

import { useListPaymentsHttpControllerList } from '@/api/generated/payments/payments';
import type { RentalListItemDto } from '@/api/generated/model';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatVnd } from '@/lib/format';

interface RentalPaymentsDialogProps {
  /** The rental whose movements are shown; null = closed. */
  rental: RentalListItemDto | null;
  onClose: () => void;
}

export function RentalPaymentsDialog({ rental, onClose }: RentalPaymentsDialogProps) {
  const { t } = useTranslation('rentals');

  // Hooks run unconditionally — the query only fires while the dialog is open.
  const { data, isPending } = useListPaymentsHttpControllerList(
    rental?.rentalId ?? '',
    { query: { enabled: rental !== null } },
  );

  return (
    <Dialog open={rental !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payments.title')}</DialogTitle>
          <DialogDescription>
            {t('payments.description', { customer: rental?.customerName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <p className="text-sm text-muted-foreground">{t('payments.loading')}</p>
        ) : data && data.data.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">{t('payments.empty')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

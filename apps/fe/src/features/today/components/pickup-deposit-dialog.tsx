import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import type { TodayBoardRentalDto } from '@/api/generated/model';
import { getListPaymentsHttpControllerListQueryKey } from '@/api/generated/payments/payments';
import {
  getGetRentalHttpControllerGetQueryKey,
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  usePickupRentalHttpControllerPickup,
} from '@/api/generated/rentals/rentals';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatVnd } from '@/lib/format';

interface PickupDepositDialogProps {
  /** null = closed. A booked rental whose ledger holds no deposit. */
  rental: TodayBoardRentalDto | null;
  onClose: () => void;
}

/** A typed amount as a whole VND ≥ 1, or null. Digits only: `Number('500.000')` is 500. */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

/**
 * FR-RENT-14 (docs/design/rentals/deposit-at-pickup.md §3): a booking with no deposit on file is
 * handed out only through this dialog — the deposit taken at the counter is recorded in the SAME
 * transaction as the handover. There is deliberately no "hand out without a deposit" button
 * (§6.Q3, a hard block). Pre-filled with the catalog standard, editable (§6.Q4).
 */
export function PickupDepositDialog({ rental, onClose }: PickupDepositDialogProps) {
  return (
    <Dialog open={rental !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {rental ? <PickupDepositBody key={rental.rentalId} rental={rental} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PickupDepositBody({
  rental,
  onClose,
}: {
  rental: TodayBoardRentalDto;
  onClose: () => void;
}) {
  const { t } = useTranslation('today');
  const queryClient = useQueryClient();
  const standardDeposit = rental.dresses.reduce((sum, dress) => sum + dress.depositAmount, 0);
  const [deposit, setDeposit] = useState(standardDeposit > 0 ? String(standardDeposit) : '');
  /** Set when another device recorded a deposit meanwhile: hand out WITHOUT one now. */
  const [onFile, setOnFile] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const amount = parseAmount(deposit);

  useEffect(() => setMessage(null), [deposit]);

  async function refresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTodayBoardHttpControllerGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListRentalsHttpControllerListQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getGetRentalHttpControllerGetQueryKey(rental.rentalId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListPaymentsHttpControllerListQueryKey(rental.rentalId),
      }),
    ]);
  }

  // The dialog renders every rejection itself; the empty onError keeps the app-wide mutation
  // toast (app/providers.tsx) from announcing it a second time.
  const pickup = usePickupRentalHttpControllerPickup({ mutation: { onError: () => undefined } });

  async function submit(): Promise<void> {
    setMessage(null);
    try {
      await pickup.mutateAsync({
        id: rental.rentalId,
        data: onFile !== null || amount === null ? {} : { depositCollected: amount },
      });
      await refresh();
      toast.success(onFile !== null ? t('pickupSuccess') : t('pickupDialog.success'));
      onClose();
    } catch (error) {
      const mapped = mapApiError(error);
      if (mapped.kind !== 'outcome') {
        toast.error(t('actionError'));
        return;
      }
      if (mapped.status === 'rejected_deposit_already_recorded') {
        const recorded = Number(mapped.recordedAmount ?? 0);
        setOnFile(recorded);
        setMessage(t('pickupDialog.alreadyRecorded', { amount: formatVnd(recorded) }));
        await refresh();
        return;
      }
      if (mapped.status === 'rejected_deposit_not_collected') {
        // Only reachable after "already recorded" if that deposit vanished — say so, keep open.
        setOnFile(null);
        setMessage(t('pickupDialog.notCollected'));
        await refresh();
        return;
      }
      toast.error(
        mapped.status === 'rejected_pickup_not_allowed'
          ? t('errors.pickupNotAllowed', {
              status: t(`status.${String(mapped.currentStatus)}`, {
                defaultValue: String(mapped.currentStatus ?? ''),
              }),
            })
          : t('errors.rentalNotFound'),
      );
      await refresh();
      onClose();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('pickupDialog.title')}</DialogTitle>
        <DialogDescription>
          {t('pickupDialog.description', { customer: rental.customerName })}
        </DialogDescription>
      </DialogHeader>
      {onFile === null ? (
        <div className="grid gap-1.5">
          <Label htmlFor="pickup-deposit">{t('pickupDialog.field')}</Label>
          <Input
            id="pickup-deposit"
            inputMode="numeric"
            autoComplete="off"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
          />
          {/* The catalog standard is a reference; the ledger records what was TAKEN. */}
          <p className="text-sm text-muted-foreground tabular-nums">
            {amount !== null
              ? formatVnd(amount)
              : t('pickupDialog.hint', { amount: formatVnd(standardDeposit) })}
          </p>
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('pickupDialog.close')}
        </Button>
        <Button
          disabled={pickup.isPending || (onFile === null && amount === null)}
          onClick={() => void submit()}
        >
          {onFile !== null ? t('actions.pickup') : t('pickupDialog.submit')}
        </Button>
      </DialogFooter>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatVnd } from '@/lib/format';

/** The fields of a rental every cancel site has (list row, board card, detail). */
export interface CancelRentalTarget {
  rentalId: string;
  customerName: string;
  status: 'booked' | 'out' | 'returned' | 'cancelled';
}

/** What the cancel sends — mirrors CancelRentalRequestDto without the kernel importing `@/api`. */
export interface CancelRentalRequest {
  expectedDepositCollected?: number;
  expectedRentalFeeCollected?: number;
  depositRefund?: number;
  rentalFeeRefund?: number;
  note?: string;
}

/** Every designed state of the cancel's answer (ADR 0001 §4), as plain data. */
export type CancelRentalResult =
  | { kind: 'ok' }
  | { kind: 'basisChanged' }
  | { kind: 'exceeds'; field: 'deposit' | 'rentalFee'; collected: number }
  | { kind: 'noteRequired' }
  | { kind: 'forbidden' }
  | { kind: 'notAllowed'; currentStatus: string }
  | { kind: 'hasPayments' }
  | { kind: 'notFound' }
  | { kind: 'fault' };

/** What `useCancelRental` (src/api/use-cancel-rental.ts) hands every cancel site. */
export interface CancelRentalController {
  /** The rental's ledger — `ready` only when it was actually read (never guess the basis). */
  ledger:
    | { state: 'loading' }
    | { state: 'error'; retry: () => void }
    | { state: 'ready'; collectedDeposit: number; collectedRentalFee: number };
  isOwner: boolean;
  pending: boolean;
  submit: (request: CancelRentalRequest) => Promise<CancelRentalResult>;
}

interface CancelRentalDialogProps {
  /** null = closed. */
  rental: CancelRentalTarget | null;
  controller: CancelRentalController;
  onClose: () => void;
}

/**
 * The ONE cancel dialog of the app (rentals/cancel-with-refund), used by the today board,
 * `/rentals` and `/rentals/:id`. An empty ledger is the plain confirm it always was; money on file
 * turns it into "Huỷ đơn & hoàn tiền" with the refund arithmetic shown (§Screen rules). Data and
 * HTTP come in through `controller`, so this stays a kernel component.
 */
export function CancelRentalDialog({ rental, controller, onClose }: CancelRentalDialogProps) {
  return (
    <AlertDialog open={rental !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        {rental ? (
          <CancelRentalBody
            key={rental.rentalId}
            rental={rental}
            controller={controller}
            onClose={onClose}
          />
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A typed amount as a number; blank or not a whole number ≥ 0 → null. */
function parseAmount(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

type ErrorSlot = 'deposit' | 'rentalFee' | 'note' | 'form';

function CancelRentalBody({
  rental,
  controller,
  onClose,
}: {
  rental: CancelRentalTarget;
  controller: CancelRentalController;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const { ledger, isOwner, pending } = controller;
  const collectedDeposit = ledger.state === 'ready' ? ledger.collectedDeposit : 0;
  const collectedRentalFee = ledger.state === 'ready' ? ledger.collectedRentalFee : 0;
  const hasMoney = collectedDeposit + collectedRentalFee > 0;

  const [deposit, setDeposit] = useState('');
  const [rentalFee, setRentalFee] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<{ slot: ErrorSlot; message: string } | null>(null);

  // §6.Q2: pre-fill the FULL refund — the default never quietly keeps a customer's money.
  // Re-primed whenever the ledger changes under the dialog (basis-changed refetch).
  useEffect(() => {
    setDeposit(String(collectedDeposit));
    setRentalFee(String(collectedRentalFee));
  }, [collectedDeposit, collectedRentalFee]);

  const depositRefund = parseAmount(deposit);
  const rentalFeeRefund = parseAmount(rentalFee);
  const refunded = (depositRefund ?? 0) + (rentalFeeRefund ?? 0);
  const retained = collectedDeposit + collectedRentalFee - refunded;

  async function submit(): Promise<void> {
    setError(null);
    const request: CancelRentalRequest = hasMoney
      ? {
          expectedDepositCollected: collectedDeposit,
          expectedRentalFeeCollected: collectedRentalFee,
          depositRefund: depositRefund ?? 0,
          rentalFeeRefund: rentalFeeRefund ?? 0,
          ...(note.trim() ? { note: note.trim() } : {}),
        }
      : {};
    const result = await controller.submit(request);
    switch (result.kind) {
      case 'ok':
        toast.success(
          refunded > 0 && hasMoney
            ? t('cancelRental.successRefunded', { amount: formatVnd(refunded) })
            : t('cancelRental.success'),
        );
        onClose();
        return;
      case 'basisChanged':
        // The ledger refetch re-primes the fields with what IS on file; the dialog stays open.
        setError({ slot: 'form', message: t('cancelRental.basisChanged') });
        return;
      case 'exceeds':
        setError({
          slot: result.field,
          message: t('cancelRental.errors.exceeds', { amount: formatVnd(result.collected) }),
        });
        return;
      case 'noteRequired':
        setError({ slot: 'note', message: t('cancelRental.errors.noteRequired') });
        return;
      case 'forbidden':
        setError({ slot: 'form', message: t('cancelRental.errors.retentionForbidden') });
        return;
      case 'fault':
        toast.error(t('cancelRental.error'));
        return;
      case 'notAllowed':
        toast.error(
          t('cancelRental.notAllowed', {
            status: t(`cancelRental.status.${result.currentStatus}`, {
              defaultValue: result.currentStatus,
            }),
          }),
        );
        break;
      case 'hasPayments':
        toast.error(t('cancelRental.hasPayments'));
        break;
      case 'notFound':
        toast.error(t('cancelRental.notFound'));
        break;
    }
    onClose(); // the rental moved on elsewhere — the controller already refreshed every view
  }

  // "Chưa đọc được sổ" is NOT "sổ trống": never offer a cancel on a guessed basis.
  if (ledger.state !== 'ready') {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('cancelRental.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {ledger.state === 'loading' ? t('states.loading') : t('cancelRental.ledgerUnavailable')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('actions.back')}</AlertDialogCancel>
          {ledger.state === 'error' ? (
            <Button variant="outline" onClick={ledger.retry}>
              {t('actions.retry')}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </>
    );
  }

  // §6.Q1: the dress is with the customer — the way out is "Nhận về", not a cancel.
  if (hasMoney && rental.status === 'out') {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('cancelRental.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('cancelRental.hasPayments')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('actions.back')}</AlertDialogCancel>
        </AlertDialogFooter>
      </>
    );
  }

  if (!hasMoney) {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('cancelRental.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('cancelRental.confirmFor', { customer: rental.customerName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* "Quay lại", never "Hủy" — the confirmed action is itself a cancel. */}
          <AlertDialogCancel>{t('actions.back')}</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => void submit()}>
            {t('cancelRental.confirmAction')}
          </Button>
        </AlertDialogFooter>
      </>
    );
  }

  const invalidAmount =
    depositRefund === null ||
    rentalFeeRefund === null ||
    depositRefund > collectedDeposit ||
    rentalFeeRefund > collectedRentalFee;
  const staffRetaining = retained > 0 && !isOwner;
  const noteMissing = retained > 0 && !note.trim();
  const errorFor = (slot: ErrorSlot) =>
    error?.slot === slot ? (
      <p role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    ) : null;

  const amountFields = [
    {
      id: 'cancel-refund-deposit',
      slot: 'deposit' as const,
      label: t('cancelRental.fields.depositRefund'),
      value: deposit,
      setValue: setDeposit,
      collected: collectedDeposit,
      collectedLabel: t('cancelRental.collected.deposit', { amount: formatVnd(collectedDeposit) }),
    },
    {
      id: 'cancel-refund-rental-fee',
      slot: 'rentalFee' as const,
      label: t('cancelRental.fields.rentalFeeRefund'),
      value: rentalFee,
      setValue: setRentalFee,
      collected: collectedRentalFee,
      collectedLabel: t('cancelRental.collected.rentalFee', {
        amount: formatVnd(collectedRentalFee),
      }),
    },
  ].filter((entry) => entry.collected > 0);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('cancelRental.refundTitle')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t('cancelRental.refundFor', { customer: rental.customerName })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="grid gap-4">
        {amountFields.map((entry) => {
          const amount = parseAmount(entry.value);
          return (
            <div key={entry.id} className="grid gap-1.5">
              <Label htmlFor={entry.id}>{entry.label}</Label>
              <Input
                id={entry.id}
                inputMode="numeric"
                autoComplete="off"
                value={entry.value}
                onChange={(event) => entry.setValue(event.target.value)}
              />
              {/* What was collected + a grouped read-back of the digits in the field. */}
              <p className="text-sm text-muted-foreground tabular-nums">
                {entry.collectedLabel}
                {amount !== null ? ` · ${formatVnd(amount)}` : ''}
              </p>
              {errorFor(entry.slot)}
            </div>
          );
        })}
        <p aria-live="polite" className="text-sm font-medium tabular-nums">
          {t('cancelRental.totals', {
            refunded: formatVnd(refunded),
            retained: formatVnd(Math.max(0, retained)),
          })}
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor="cancel-refund-note">
            {retained > 0 ? t('cancelRental.fields.noteRequired') : t('cancelRental.fields.note')}
          </Label>
          <Textarea
            id="cancel-refund-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {errorFor('note')}
        </div>
        {staffRetaining ? (
          <p className="text-sm text-destructive">{t('cancelRental.errors.retentionForbidden')}</p>
        ) : null}
        {errorFor('form')}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>{t('actions.back')}</AlertDialogCancel>
        <Button
          variant="destructive"
          disabled={pending || invalidAmount || staffRetaining || noteMissing}
          onClick={() => void submit()}
        >
          {t('cancelRental.refundAction')}
        </Button>
      </AlertDialogFooter>
    </>
  );
}

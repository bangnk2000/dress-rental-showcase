import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import {
  getListPaymentsHttpControllerListQueryKey,
  useListPaymentsHttpControllerList,
} from '@/api/generated/payments/payments';
import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useQuoteLateFeeHttpControllerQuote,
  useReturnRentalHttpControllerSettle,
} from '@/api/generated/rentals/rentals';
import type { ReturnRentalRequestDto, TodayBoardRentalDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatVnd } from '@/lib/format';

import {
  returnFormDefaults,
  returnFormSchema,
  type ReturnFormValues,
} from '../schemas/return-form.schema';
import { TodayFormMessage } from './today-form-message';

interface ReturnRentalDialogProps {
  /** The rental being settled; null = closed. */
  rental: TodayBoardRentalDto | null;
  onClose: () => void;
}

/**
 * A typed amount as a number, or null when the field is blank or not yet a valid amount. Used only
 * for the on-screen arithmetic — the zod schema still owns what may be submitted.
 */
function parseAmount(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/** Blank amounts are omitted — the API records only what staff entered. */
function toReturnRequest(values: ReturnFormValues): ReturnRentalRequestDto {
  return {
    ...(values.lateFee ? { lateFee: Number(values.lateFee) } : {}),
    ...(values.damageFee ? { damageFee: Number(values.damageFee) } : {}),
    ...(values.depositRefund ? { depositRefund: Number(values.depositRefund) } : {}),
    ...(values.note ? { note: values.note } : {}),
  };
}

export function ReturnRentalDialog({ rental, onClose }: ReturnRentalDialogProps) {
  const { t } = useTranslation('today');
  const { t: tCommon } = useTranslation('common'); // shared verbs only
  const queryClient = useQueryClient();

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: returnFormDefaults,
  });

  /**
   * FR-RENT-09: the server owns the late-fee number, so the dialog ASKS for it and pre-fills the
   * field. Staff reads the amount to the customer before confirming; only the owner may charge
   * less (the mutation answers `forbidden` otherwise).
   */
  const lateFee = useQuoteLateFeeHttpControllerQuote(rental?.rentalId ?? '', {
    query: { enabled: rental !== null, staleTime: 0 },
  });
  const quote = lateFee.data ?? null;

  /**
   * FR-PAY-02: the refund is computed from the deposit the shop ACTUALLY took, which lives in the
   * rental's ledger. That number is recorded money, so it may fill the field; the catalog figure
   * is only a fallback for rentals booked before deposits were recorded, and it stays a
   * SUGGESTION staff has to accept, because refunding a reference figure is a guess.
   */
  const payments = useListPaymentsHttpControllerList(rental?.rentalId ?? '', {
    query: { enabled: rental !== null, staleTime: 0 },
  });
  const collectedDeposit = payments.data?.summary.deposit ?? 0;
  const standardDeposit = rental
    ? rental.dresses.reduce((sum, dress) => sum + dress.depositAmount, 0)
    : 0;
  const depositIsCollected = collectedDeposit > 0;
  const depositTotal = depositIsCollected ? collectedDeposit : standardDeposit;
  const suggestedLateFee = quote?.suggestedLateFee ?? null;
  /**
   * Without the quote the late fee is unknown, NOT zero — and omitting `lateFee` makes the server
   * charge its own computed fee. Offering the full deposit here would hand back the fee the
   * shop is about to charge, so nothing is offered until the number is known.
   */
  const suggestionAvailable = depositTotal > 0 && quote !== null;

  // One dialog instance serves every rental, so the form is re-primed per OPEN — keyed on the
  // rental id, not the DTO: the board refetches while the dialog is up, and a new object identity
  // for the same rental must not wipe a half-typed settlement.
  const rentalId = rental?.rentalId ?? null;
  const { reset, setValue, getFieldState } = form;
  useEffect(() => {
    if (!rentalId) return;
    reset(returnFormDefaults);
  }, [rentalId, reset]);

  // The quote arrives after the dialog is already usable, so seeding must not be a reset: on a
  // slow connection staff has often typed the waiver note or a fee by then, and losing that
  // silently is worse than an empty field. Only UNTOUCHED fields are seeded.
  //
  // The refund is filled ONLY when the deposit is recorded money (FR-PAY-02): `collected − fee` is
  // then arithmetic over amounts the shop actually holds. With no deposit on file the basis is the
  // catalog's figure, which is a guess — it stays a suggestion staff has to tap.
  useEffect(() => {
    if (!rentalId || suggestedLateFee === null) return;
    if (!getFieldState('lateFee').isDirty) {
      setValue('lateFee', suggestedLateFee > 0 ? String(suggestedLateFee) : '');
    }
    if (depositIsCollected && !getFieldState('depositRefund').isDirty) {
      setValue('depositRefund', String(Math.max(0, collectedDeposit - suggestedLateFee)));
    }
  }, [
    rentalId,
    suggestedLateFee,
    depositIsCollected,
    collectedDeposit,
    setValue,
    getFieldState,
  ]);

  // Live arithmetic for the reference block: what is left of the deposit once the amounts
  // currently in the two fee fields are taken out.
  const typedLateFee = parseAmount(form.watch('lateFee')) ?? 0;
  const typedDamageFee = parseAmount(form.watch('damageFee')) ?? 0;
  const typedRefund = parseAmount(form.watch('depositRefund'));
  const refundAfterFees = Math.max(0, depositTotal - typedLateFee - typedDamageFee);
  const refundDiffersFromSuggestion =
    depositTotal > 0 && typedRefund !== null && typedRefund !== refundAfterFees;

  async function refreshBoardAndList(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTodayBoardHttpControllerGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListRentalsHttpControllerListQueryKey() }),
    ]);
  }

  /**
   * A settlement WRITES movements, so the rental's ledger must be invalidated as well — the money
   * screen on /rentals reads the same query and would otherwise show a pre-settlement ledger for
   * up to the 60s staleTime. The Playwright happy path caught exactly that.
   */
  async function refreshPayments(): Promise<void> {
    if (!rental) return;
    await queryClient.invalidateQueries({
      queryKey: getListPaymentsHttpControllerListQueryKey(rental.rentalId),
    });
  }

  const returnRental = useReturnRentalHttpControllerSettle({
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
          refreshPayments(),
        ]);
        toast.success(t('returnDialog.success'));
        onClose();
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome') {
          // The two waiver rejections are FIXABLE in place — keep the dialog open so staff can
          // put the suggested number back, or the owner can type the reason (ADR 0001 §4).
          if (mapped.status === 'forbidden') {
            form.setError('lateFee', { message: 'errors.lateFeeWaiverForbidden' });
            return;
          }
          if (mapped.status === 'rejected_waiver_note_required') {
            form.setError('note', { message: 'errors.waiverNoteRequired' });
            form.setFocus('note');
            return;
          }
          // Anything else means the rental moved on — nothing left to settle here.
          toast.error(
            mapped.status === 'rejected_return_not_allowed'
              ? t('errors.returnNotAllowed', {
                  status: t(`status.${String(mapped.currentStatus)}`, {
                    defaultValue: String(mapped.currentStatus ?? ''),
                  }),
                })
              : t('errors.rentalNotFound'),
          );
          await refreshBoardAndList();
          onClose();
          return;
        }
        toast.error(t('actionError'));
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!rental) return;
    returnRental.mutate({ id: rental.rentalId, data: toReturnRequest(values) });
  });

  const amountFields = [
    { name: 'lateFee', label: t('returnDialog.fields.lateFee') },
    { name: 'damageFee', label: t('returnDialog.fields.damageFee') },
    { name: 'depositRefund', label: t('returnDialog.fields.depositRefund') },
  ] as const;

  return (
    <Dialog open={rental !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('returnDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('returnDialog.description', { customer: rental?.customerName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4" noValidate>
            {/* FR-RENT-09 banner: the number staff reads to the customer, before confirming. */}
            <div aria-live="polite" className="text-sm">
              {lateFee.isPending ? (
                <span className="text-muted-foreground">{t('returnDialog.lateFee.loading')}</span>
              ) : lateFee.isError ? (
                <span className="text-destructive">{t('returnDialog.lateFee.unavailable')}</span>
              ) : quote && quote.daysLate > 0 ? (
                <span className="font-medium text-destructive">
                  {t('returnDialog.lateFee.late', {
                    days: quote.daysLate,
                    dresses: quote.dressCount,
                    amount: formatVnd(quote.suggestedLateFee),
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">{t('returnDialog.lateFee.onTime')}</span>
              )}
            </div>
            {/* The deposit the catalog carries, and what would be left of it after the fees
                currently typed — the refund field is seven digits nobody should reproduce from
                memory. Live, so editing a fee immediately shows what the customer would get back.
                It fills the field only when staff taps it: the shop has no record of what was
                actually taken, so this number is a suggestion, not a fact. */}
            {suggestionAvailable ? (
              <div aria-live="polite" className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="text-muted-foreground">
                  {depositIsCollected
                    ? t('returnDialog.deposit.collected', { amount: formatVnd(depositTotal) })
                    : t('returnDialog.deposit.standard', {
                        count: rental?.dresses.length ?? 0,
                        amount: formatVnd(depositTotal),
                      })}
                </p>
                <p className="font-medium">
                  {t('returnDialog.deposit.afterFees', {
                    fees: formatVnd(typedLateFee + typedDamageFee),
                    amount: formatVnd(refundAfterFees),
                  })}
                </p>
                {refundDiffersFromSuggestion ? (
                  <p className="text-muted-foreground">
                    {t('returnDialog.deposit.manual', { amount: formatVnd(typedRefund) })}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    form.setValue('depositRefund', String(refundAfterFees), {
                      shouldValidate: true,
                    })
                  }
                >
                  {t('returnDialog.deposit.use', { amount: formatVnd(refundAfterFees) })}
                </Button>
              </div>
            ) : null}
            {amountFields.map(({ name, label }) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => {
                  const amount = parseAmount(field.value);
                  return (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" autoComplete="off" {...field} />
                      </FormControl>
                      {/* Grouped read-back of the digits actually in the field: 3000000 and
                          300000 differ by one keystroke and by 2.700.000 ₫. */}
                      {amount !== null ? (
                        <FormDescription className="tabular-nums">
                          {formatVnd(amount)}
                        </FormDescription>
                      ) : null}
                      <TodayFormMessage />
                    </FormItem>
                  );
                }}
              />
            ))}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('returnDialog.fields.note')}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <TodayFormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {tCommon('actions.cancel')}
              </Button>
              {/* Never submit before the suggested fee AND the collected deposit are known: a
                  blind submit would charge whatever the empty field means (tripping the waiver
                  rule) or hand back a refund computed from the catalog instead of the till. */}
              <Button
                type="submit"
                disabled={returnRental.isPending || lateFee.isPending || payments.isPending}
              >
                {t('returnDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

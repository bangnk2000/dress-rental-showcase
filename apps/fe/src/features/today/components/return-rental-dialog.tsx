import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
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
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
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

  // One dialog instance serves every rental, so the form is re-primed per OPEN — keyed on the
  // rental id, not the DTO: the board refetches while the dialog is up, and a new object identity
  // for the same rental must not wipe a half-typed settlement.
  const rentalId = rental?.rentalId ?? null;
  const { reset, setValue, getFieldState } = form;
  useEffect(() => {
    if (!rentalId) return;
    reset(returnFormDefaults);
  }, [rentalId, reset]);

  // The quote arrives after the dialog is already usable, so seeding it must not be a reset: on a
  // slow connection staff has often typed the waiver note or a fee by then, and losing that
  // silently is worse than an empty field. Only an untouched field takes the server's number.
  const suggestedLateFee = quote?.suggestedLateFee ?? null;
  useEffect(() => {
    if (!rentalId || suggestedLateFee === null) return;
    if (getFieldState('lateFee').isDirty) return;
    setValue('lateFee', suggestedLateFee > 0 ? String(suggestedLateFee) : '');
  }, [rentalId, suggestedLateFee, setValue, getFieldState]);

  async function refreshBoardAndList(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTodayBoardHttpControllerGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListRentalsHttpControllerListQueryKey() }),
    ]);
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
            {amountFields.map(({ name, label }) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" {...field} />
                    </FormControl>
                    <TodayFormMessage />
                  </FormItem>
                )}
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
              {/* Never submit before the suggested fee is known: a blind submit would charge
                  whatever the empty field means and could trip the waiver rule. */}
              <Button type="submit" disabled={returnRental.isPending || lateFee.isPending}>
                {t('returnDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

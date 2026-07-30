import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
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

import { isConflictError } from '../lib/is-conflict-error';
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

  // Re-prime per open: the dialog instance is reused across rentals.
  const { reset } = form;
  useEffect(() => {
    if (rental) reset(returnFormDefaults);
  }, [rental, reset]);

  const returnRental = useReturnRentalHttpControllerSettle<unknown>({
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
      onError: (error) => {
        toast.error(
          isConflictError(error) ? t('alreadyProcessed') : t('actionError'),
        );
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
              <Button type="submit" disabled={returnRental.isPending}>
                {t('returnDialog.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

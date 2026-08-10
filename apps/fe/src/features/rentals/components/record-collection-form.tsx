import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
import { getListPaymentsHttpControllerListQueryKey } from '@/api/generated/payments/payments';
import { useRecordCollectionHttpControllerCollect } from '@/api/generated/payments/payments';
import type {
  PaymentSummaryDto,
  RecordCollectionRequestDto,
  RentalListItemDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
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
  collectionFormDefaults,
  collectionFormSchema,
  type CollectionFormValues,
} from '../schemas/collection-form.schema';
import { RentalFormMessage } from './rental-form-message';

interface RecordCollectionFormProps {
  rental: RentalListItemDto;
  /** What is already on file — a kind with a total > 0 is no longer offered for entry. */
  summary: PaymentSummaryDto;
  /** The rental moved on (returned/cancelled) while the dialog was open. */
  onRentalClosed: (currentStatus: string) => void;
  onRentalGone: () => void;
}

/** A typed amount as a number, or null when the field is blank or not yet a valid amount. */
function parseAmount(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Blank AND zero amounts are omitted — the ledger records only what was actually collected, and
 * "not collected" is the absence of the field (the API's `@Min(1)` says the same). Typing 0 in one
 * field must not 400 the whole request and lose the other, genuine amount with it.
 */
function toCollectRequest(values: CollectionFormValues): RecordCollectionRequestDto {
  const deposit = parseAmount(values.deposit);
  const rentalFee = parseAmount(values.rentalFee);
  return {
    ...(deposit !== null ? { deposit } : {}),
    ...(rentalFee !== null ? { rentalFee } : {}),
    ...(values.note ? { note: values.note } : {}),
  };
}

/**
 * FR-PAY-02: writes down money that already changed hands. Both amounts are PRE-FILLED — the
 * deposit from the catalog standard, the rental fee from what was agreed per dress — because
 * seven digits typed from memory is the error this shop keeps making. The number sent is whatever
 * the staff leaves in the field: the ledger records what was taken, not what was expected.
 */
export function RecordCollectionForm({
  rental,
  summary,
  onRentalClosed,
  onRentalGone,
}: RecordCollectionFormProps) {
  const { t } = useTranslation('rentals');
  const queryClient = useQueryClient();

  const depositRecorded = summary.deposit > 0;
  const rentalFeeRecorded = summary.rentalFee > 0;
  const standardDeposit = rental.dresses.reduce((sum, dress) => sum + dress.depositAmount, 0);
  const agreedTotal = rental.dresses.reduce((sum, dress) => sum + dress.agreedPrice, 0);

  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: collectionFormDefaults,
  });

  // Re-prime per rental: one dialog instance serves every row. A kind already on file is not
  // offered again, so its field stays blank instead of inviting a duplicate.
  const { reset } = form;
  useEffect(() => {
    reset({
      ...collectionFormDefaults,
      deposit: depositRecorded || standardDeposit < 1 ? '' : String(standardDeposit),
      rentalFee: rentalFeeRecorded || agreedTotal < 1 ? '' : String(agreedTotal),
    });
  }, [rental.rentalId, depositRecorded, rentalFeeRecorded, standardDeposit, agreedTotal, reset]);

  const recordCollection = useRecordCollectionHttpControllerCollect({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListPaymentsHttpControllerListQueryKey(rental.rentalId),
        });
        toast.success(t('collect.success'));
        form.reset(collectionFormDefaults);
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome') {
          // Both "already recorded" rejections are fixable in place: the ledger below refreshes
          // and states the amount on file, so staff sees what the shop already has.
          if (
            mapped.status === 'rejected_deposit_already_recorded' ||
            mapped.status === 'rejected_rental_fee_already_recorded'
          ) {
            form.setError(
              mapped.status === 'rejected_deposit_already_recorded' ? 'deposit' : 'rentalFee',
              { message: 'collect.errors.alreadyRecorded' },
            );
            await queryClient.invalidateQueries({
              queryKey: getListPaymentsHttpControllerListQueryKey(rental.rentalId),
            });
            return;
          }
          if (mapped.status === 'rejected_nothing_to_record') {
            form.setError('deposit', { message: 'collect.errors.nothingToRecord' });
            return;
          }
          if (mapped.status === 'rejected_rental_closed') {
            onRentalClosed(String(mapped.currentStatus ?? ''));
            return;
          }
          onRentalGone();
          return;
        }
        toast.error(t('collect.error'));
      },
    },
  });

  const typedDeposit = parseAmount(form.watch('deposit'));
  const typedRentalFee = parseAmount(form.watch('rentalFee'));
  const nothingTyped = typedDeposit === null && typedRentalFee === null;

  const onSubmit = form.handleSubmit((values) => {
    recordCollection.mutate({ rentalId: rental.rentalId, data: toCollectRequest(values) });
  });

  const amountFields = [
    {
      name: 'deposit',
      label: t('collect.fields.deposit'),
      recorded: depositRecorded,
      recordedAmount: summary.deposit,
      hint: t('collect.hints.standardDeposit', { amount: formatVnd(standardDeposit) }),
    },
    {
      name: 'rentalFee',
      label: t('collect.fields.rentalFee'),
      recorded: rentalFeeRecorded,
      recordedAmount: summary.rentalFee,
      hint: t('collect.hints.agreedTotal', { amount: formatVnd(agreedTotal) }),
    },
  ] as const;

  if (depositRecorded && rentalFeeRecorded) {
    return <p className="text-sm text-muted-foreground">{t('collect.allRecorded')}</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4" noValidate>
        <p className="text-sm font-medium">{t('collect.title')}</p>
        {amountFields.map(({ name, label, recorded, recordedAmount, hint }) =>
          recorded ? (
            <p key={name} className="text-sm text-muted-foreground">
              {t('collect.alreadyRecorded', { label, amount: formatVnd(recordedAmount) })}
            </p>
          ) : (
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
                    <FormDescription className="tabular-nums">
                      {amount !== null ? formatVnd(amount) : hint}
                    </FormDescription>
                    <RentalFormMessage />
                  </FormItem>
                );
              }}
            />
          ),
        )}
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('collect.fields.note')}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <RentalFormMessage />
            </FormItem>
          )}
        />
        <div>
          {/* Nothing typed = nothing to record; the API says so too, but there is no reason to
              spend a round trip on it. */}
          <Button type="submit" disabled={recordCollection.isPending || nothingTyped}>
            {t('collect.submit')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

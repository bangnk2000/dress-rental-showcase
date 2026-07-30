import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import {
  getGetTodayBoardHttpControllerGetQueryKey,
  getListRentalsHttpControllerListQueryKey,
  useCreateRentalHttpControllerCreate,
} from '@/api/generated/rentals/rentals';
import type { CreateRentalRequestDto } from '@/api/generated/model';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { DressPicker, type SelectedDress } from './components/dress-picker';
import { RentalFormMessage } from './components/rental-form-message';
import { isConflictError } from './lib/is-conflict-error';
import {
  rentalFormDefaults,
  rentalFormSchema,
  type RentalFormValues,
} from './schemas/rental-form.schema';

/** Form values + picked dresses → request body; blank notes are omitted. */
function toCreateRentalRequest(
  values: RentalFormValues,
  selected: SelectedDress[],
): CreateRentalRequestDto {
  return {
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    startDate: values.startDate,
    endDate: values.endDate,
    ...(values.notes ? { notes: values.notes } : {}),
    // Price omitted on purpose: the BE defaults to each dress's standard price.
    items: selected.map((dress) => ({ dressId: dress.id })),
  };
}

export function NewRentalRoute() {
  const { t } = useTranslation('rentals');
  const { t: tCommon } = useTranslation('common'); // shared verbs only
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: rentalFormDefaults,
  });
  const [selected, setSelected] = useState<SelectedDress[]>([]);
  /** i18n key — set on empty selection at submit, or on a 409 from the API. */
  const [formError, setFormError] = useState<string | null>(null);

  // TError widened from the generated default (void) so onError can inspect
  // the 409 (retired / period unavailable). Defining onError here also
  // overrides the global "mutation failed" toast for this mutation.
  const createRental = useCreateRentalHttpControllerCreate<unknown>({
    mutation: {
      onSuccess: async () => {
        // The cached list/board may still be FRESH (staleTime 60s) — without
        // this, the post-create landing shows a list missing the new rental.
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getListRentalsHttpControllerListQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getGetTodayBoardHttpControllerGetQueryKey(),
          }),
        ]);
        toast.success(t('form.success'));
        void navigate('/rentals');
      },
      onError: (error) => {
        if (isConflictError(error)) {
          // 409 = dress retired or booked for an overlapping (buffered) period.
          setFormError('form.errors.unavailable');
          return;
        }
        toast.error(t('form.error'));
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (selected.length === 0) {
      setFormError('form.errors.noDresses');
      return;
    }
    setFormError(null);
    createRental.mutate({ data: toCreateRentalRequest(values, selected) });
  });

  const translate = t as unknown as (key: string) => string;

  return (
    <>
      <PageHeader title={t('newTitle')} />
      <Form {...form}>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="grid max-w-2xl gap-4"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.customerName')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <RentalFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.customerPhone')}</FormLabel>
                  <FormControl>
                    <Input inputMode="tel" autoComplete="off" {...field} />
                  </FormControl>
                  <RentalFormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.startDate')}</FormLabel>
                  <FormControl>
                    <Input type="date" autoComplete="off" {...field} />
                  </FormControl>
                  <RentalFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.endDate')}</FormLabel>
                  <FormControl>
                    <Input type="date" autoComplete="off" {...field} />
                  </FormControl>
                  <RentalFormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="text-sm text-muted-foreground">{t('form.bufferHint')}</p>
          <DressPicker
            selected={selected}
            onAdd={(dress) => {
              setSelected((current) => [...current, dress]);
              setFormError(null);
            }}
            onRemove={(dressId) =>
              setSelected((current) => current.filter((dress) => dress.id !== dressId))
            }
            error={formError === 'form.errors.noDresses' ? formError : null}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.fields.notes')}</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <RentalFormMessage />
              </FormItem>
            )}
          />
          {formError === 'form.errors.unavailable' ? (
            <p role="alert" className="text-sm text-destructive">
              {translate(formError)}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => void navigate('/rentals')}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" disabled={createRental.isPending}>
              {t('form.submit')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

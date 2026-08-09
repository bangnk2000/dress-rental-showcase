import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { outcomeStatus } from '@/api/errors';
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
  /** i18n key — set on empty selection at submit, or from a rejection outcome. */
  const [formError, setFormError] = useState<string | null>(null);

  // One designed state per outcome code (ADR 0001 §4): the form stays filled and says WHICH
  // dresses are the problem. Defining onError here also overrides the global mutation toast.
  const createRental = useCreateRentalHttpControllerCreate({
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
        switch (outcomeStatus(error)) {
          case 'rejected_dress_unavailable':
            setFormError('form.errors.dressUnavailable');
            return;
          case 'rejected_dress_retired':
            setFormError('form.errors.dressRetired');
            return;
          case 'rejected_dress_not_found':
            setFormError('form.errors.dressNotFound');
            return;
          default:
            toast.error(t('form.error'));
        }
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
          {/* Every rejection outcome renders form-level here; the picker owns only noDresses. */}
          {formError && formError !== 'form.errors.noDresses' ? (
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

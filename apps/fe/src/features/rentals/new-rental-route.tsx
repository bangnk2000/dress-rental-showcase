import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { mapApiError } from '@/api/errors';
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

import {
  DressPicker,
  type BlockedDresses,
  type PickerPeriod,
  type SelectedDress,
} from './components/dress-picker';
import { RentalFormMessage } from './components/rental-form-message';
import {
  rentalFormDefaults,
  rentalFormSchema,
  type RentalFormValues,
} from './schemas/rental-form.schema';

/**
 * The `dressIds` an outcome payload carries (ADR 0001 §3). Typed as `unknown` at the seam, so the
 * form checks the shape rather than trusting it.
 */
function readDressIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

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
  /** Which dresses the last rejection named (ADR 0001 payload), so the picker can point at them. */
  const [blocked, setBlocked] = useState<BlockedDresses | null>(null);

  // The dates the picker checks against. Only a sensible range is worth asking the server about.
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');
  const period: PickerPeriod | null =
    startDate && endDate && startDate <= endDate ? { startDate, endDate } : null;

  // A rejection belongs to the dates it was answered for. Changing them makes it stale, and the
  // per-dress availability check below is what answers for the new range.
  useEffect(() => {
    setBlocked(null);
  }, [startDate, endDate]);

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
        const mapped = mapApiError(error);
        const dressIds = mapped.kind === 'outcome' ? readDressIds(mapped.dressIds) : [];
        switch (mapped.kind === 'outcome' ? mapped.status : null) {
          case 'rejected_dress_unavailable':
            setFormError('form.errors.dressUnavailable');
            setBlocked({ dressIds, reason: 'unavailable' });
            return;
          case 'rejected_dress_retired':
            setFormError('form.errors.dressRetired');
            setBlocked({ dressIds, reason: 'retired' });
            return;
          case 'rejected_dress_not_found':
            setFormError('form.errors.dressNotFound');
            setBlocked({ dressIds, reason: 'notFound' });
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
              setBlocked(null);
            }}
            onRemove={(dressId) => {
              setSelected((current) => current.filter((dress) => dress.id !== dressId));
              setBlocked(null);
            }}
            error={formError === 'form.errors.noDresses' ? formError : null}
            period={period}
            blocked={blocked}
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

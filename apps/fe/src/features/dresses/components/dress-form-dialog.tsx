import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  getGetDressHttpControllerGetQueryKey,
  getListDressesHttpControllerListQueryKey,
  useCreateDressHttpControllerCreate,
  useUpdateDressHttpControllerUpdate,
} from '@/api/generated/catalog/catalog';
import type {
  CreateDressRequestDto,
  DressResponseDto,
  UpdateDressRequestDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
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
  dressFormDefaults,
  dressFormSchema,
  parsePhotoUrls,
  type DressFormValues,
} from '../schemas/dress-form.schema';
import { DressFormMessage } from './dress-form-message';

interface DressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this dress instead of creating one. */
  dress?: DressResponseDto;
}

function toFormValues(dress: DressResponseDto): DressFormValues {
  return {
    code: dress.code,
    name: dress.name,
    sizeLabel: dress.sizeLabel ?? '',
    rentalPrice: String(dress.rentalPrice),
    depositAmount: String(dress.depositAmount),
    notes: dress.notes ?? '',
    photoUrls: dress.photoUrls.join('\n'),
  };
}

/** Form values (strings) → create body; blank optional fields are omitted. */
function toCreateDressRequest(values: DressFormValues): CreateDressRequestDto {
  const photoUrls = parsePhotoUrls(values.photoUrls);
  return {
    code: values.code,
    name: values.name,
    rentalPrice: Number(values.rentalPrice),
    depositAmount: Number(values.depositAmount),
    ...(values.sizeLabel ? { sizeLabel: values.sizeLabel } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
    ...(photoUrls.length > 0 ? { photoUrls } : {}),
  };
}

/** Edit sends the full form: blank nullable fields become explicit nulls (PATCH clears them). */
function toUpdateDressRequest(values: DressFormValues): UpdateDressRequestDto {
  return {
    code: values.code,
    name: values.name,
    sizeLabel: values.sizeLabel ? values.sizeLabel : null,
    rentalPrice: Number(values.rentalPrice),
    depositAmount: Number(values.depositAmount),
    notes: values.notes ? values.notes : null,
    photoUrls: parsePhotoUrls(values.photoUrls),
  };
}

export function DressFormDialog({ open, onOpenChange, dress }: DressFormDialogProps) {
  const { t } = useTranslation('dresses');
  const { t: tCommon } = useTranslation('common'); // shared verbs only
  const queryClient = useQueryClient();

  const form = useForm<DressFormValues>({
    resolver: zodResolver(dressFormSchema),
    defaultValues: dress ? toFormValues(dress) : dressFormDefaults,
  });

  // Re-prime on every open: the SAME dialog instance serves create and edit,
  // and the dress in the cache may have changed since the last open.
  const { reset } = form;
  useEffect(() => {
    if (open) reset(dress ? toFormValues(dress) : dressFormDefaults);
  }, [open, dress, reset]);

  function handleOpenChange(next: boolean) {
    if (!next) form.reset();
    onOpenChange(next);
  }

  async function invalidateDressQueries() {
    // The parameterless generated key prefixes every filtered/paginated list key.
    await queryClient.invalidateQueries({
      queryKey: getListDressesHttpControllerListQueryKey(),
    });
    if (dress) {
      await queryClient.invalidateQueries({
        queryKey: getGetDressHttpControllerGetQueryKey(dress.id),
      });
    }
  }

  // TError widened from the generated default (void) so onError can inspect
  // the 409 duplicate-code case. Defining onError here also overrides the
  // global "mutation failed" toast for these mutations.
  const createDress = useCreateDressHttpControllerCreate<unknown>({
    mutation: {
      onSuccess: async () => {
        await invalidateDressQueries();
        toast.success(t('form.success'));
        handleOpenChange(false);
      },
      onError: (error) => {
        if (isConflictError(error)) {
          // 409 = duplicate code; the contract has no typed body for it.
          form.setError('code', { message: 'form.errors.duplicateCode' });
          return;
        }
        toast.error(t('form.error'));
      },
    },
  });

  const updateDress = useUpdateDressHttpControllerUpdate<unknown>({
    mutation: {
      onSuccess: async () => {
        await invalidateDressQueries();
        toast.success(t('form.updateSuccess'));
        handleOpenChange(false);
      },
      onError: (error) => {
        if (isConflictError(error)) {
          form.setError('code', { message: 'form.errors.duplicateCode' });
          return;
        }
        toast.error(t('form.updateError'));
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (dress) {
      updateDress.mutate({ id: dress.id, data: toUpdateDressRequest(values) });
    } else {
      createDress.mutate({ data: toCreateDressRequest(values) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dress ? t('form.editTitle') : t('form.title')}</DialogTitle>
          <DialogDescription>
            {dress ? t('form.editDescription') : t('form.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.code')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.name')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sizeLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.sizeLabel')}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="rentalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.fields.rentalPrice')}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" {...field} />
                    </FormControl>
                    <DressFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.fields.depositAmount')}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" {...field} />
                    </FormControl>
                    <DressFormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="photoUrls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.photoUrls')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={t('form.fields.photoUrlsPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <DressFormMessage />
                </FormItem>
              )}
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
                  <DressFormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {tCommon('actions.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createDress.isPending || updateDress.isPending}>
                {tCommon('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

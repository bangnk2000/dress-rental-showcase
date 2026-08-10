import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { outcomeStatus } from '@/api/errors';
import {
  getGetDressHttpControllerGetQueryKey,
  getListDressesHttpControllerListQueryKey,
  useCreateDressHttpControllerCreate,
  useListCategoriesHttpControllerList,
  useUpdateDressHttpControllerUpdate,
} from '@/api/generated/catalog/catalog';
import { useMeHttpControllerMe } from '@/api/generated/identity/identity';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  CATEGORY_NONE,
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
    categoryId: dress.categoryId ?? CATEGORY_NONE,
    // Staff responses have no key at all — the form value stays '' and is never sent back.
    purchasePrice: dress.purchasePrice != null ? String(dress.purchasePrice) : '',
  };
}

/**
 * Form values (strings) → create body; blank optional fields are omitted. purchasePrice rides
 * along ONLY for the owner (FR-CAT-05) — a staff request carrying it would be a named 403.
 */
function toCreateDressRequest(values: DressFormValues, isOwner: boolean): CreateDressRequestDto {
  const photoUrls = parsePhotoUrls(values.photoUrls);
  return {
    code: values.code,
    name: values.name,
    rentalPrice: Number(values.rentalPrice),
    depositAmount: Number(values.depositAmount),
    ...(values.sizeLabel ? { sizeLabel: values.sizeLabel } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
    ...(photoUrls.length > 0 ? { photoUrls } : {}),
    ...(values.categoryId !== CATEGORY_NONE ? { categoryId: values.categoryId } : {}),
    ...(isOwner && values.purchasePrice ? { purchasePrice: Number(values.purchasePrice) } : {}),
  };
}

/**
 * Edit sends the full form: blank nullable fields become explicit nulls (PATCH clears them).
 * EXCEPT purchasePrice for staff: the field must be ABSENT from their request (presence — even
 * null — is the refused act, FR-CAT-05).
 */
function toUpdateDressRequest(values: DressFormValues, isOwner: boolean): UpdateDressRequestDto {
  return {
    code: values.code,
    name: values.name,
    sizeLabel: values.sizeLabel ? values.sizeLabel : null,
    rentalPrice: Number(values.rentalPrice),
    depositAmount: Number(values.depositAmount),
    notes: values.notes ? values.notes : null,
    photoUrls: parsePhotoUrls(values.photoUrls),
    categoryId: values.categoryId === CATEGORY_NONE ? null : values.categoryId,
    ...(isOwner
      ? { purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : null }
      : {}),
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

  // The category options load only while the dialog is open; the list is tiny and cached.
  const categoriesQuery = useListCategoriesHttpControllerList({ query: { enabled: open } });
  const categories = categoriesQuery.data?.data ?? [];

  // Display gate only — the BE refuses a staff request carrying the field either way. The me
  // query is already in the cache (the session provider hydrated it).
  const { data: me } = useMeHttpControllerMe();
  const isOwner = me?.role === 'owner';

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

  // One designed state per outcome code (ADR 0001 §4). Defining onError here also overrides the
  // global "mutation failed" toast for these mutations.
  const createDress = useCreateDressHttpControllerCreate({
    mutation: {
      onSuccess: async () => {
        await invalidateDressQueries();
        toast.success(t('form.success'));
        handleOpenChange(false);
      },
      onError: (error) => {
        if (outcomeStatus(error) === 'rejected_dress_code_taken') {
          form.setError('code', { message: 'form.errors.duplicateCode' });
          return;
        }
        toast.error(t('form.error'));
      },
    },
  });

  const updateDress = useUpdateDressHttpControllerUpdate({
    mutation: {
      onSuccess: async () => {
        await invalidateDressQueries();
        toast.success(t('form.updateSuccess'));
        handleOpenChange(false);
      },
      onError: async (error) => {
        switch (outcomeStatus(error)) {
          case 'rejected_dress_code_taken':
            form.setError('code', { message: 'form.errors.duplicateCode' });
            return;
          case 'rejected_dress_not_found':
            // Someone deleted/retired it under us: the dialog has nothing left to edit.
            await invalidateDressQueries();
            toast.error(t('errors.notFound'));
            handleOpenChange(false);
            return;
          default:
            toast.error(t('form.updateError'));
        }
      },
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (dress) {
      updateDress.mutate({ id: dress.id, data: toUpdateDressRequest(values, isOwner) });
    } else {
      createDress.mutate({ data: toCreateDressRequest(values, isOwner) });
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
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.fields.category')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={CATEGORY_NONE}>{t('form.categoryNone')}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            {/* NOT rendered for staff (not disabled — disabled invites "why is it grey?"):
                the field simply is not theirs (FR-CAT-05). */}
            {isOwner ? (
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('form.fields.purchasePrice')}</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" {...field} />
                    </FormControl>
                    <DressFormMessage />
                  </FormItem>
                )}
              />
            ) : null}
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

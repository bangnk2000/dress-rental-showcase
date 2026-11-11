import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
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
import { usePhotoUploader } from '@/api/use-photo-uploader';
import type {
  CreateDressRequestDto,
  DressResponseDto,
  UpdateDressRequestDto,
} from '@/api/generated/model';
import {
  photoUrlsOf,
  revokePhotoPreviews,
  toPhotoItems,
  uploadLocalPhotos,
  type PhotoItem,
} from '@/components/media/photo-items';
import { PhotoListField } from '@/components/media/photo-list-field';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  CATEGORY_NONE,
  dressFormDefaults,
  dressFormSchema,
  type DressFormValues,
} from '../schemas/dress-form.schema';
import { DressFormMessage } from './dress-form-message';
import { SizeOptionGroup } from './size-option-group';

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
    photos: toPhotoItems(dress.photoUrls),
    categoryId: dress.categoryId ?? CATEGORY_NONE,
    // Staff responses have no key at all — the form value stays '' and is never sent back.
    purchasePrice: dress.purchasePrice != null ? String(dress.purchasePrice) : '',
  };
}

/**
 * Form values (strings) → create body; blank optional fields are omitted. purchasePrice rides
 * along ONLY for the owner (FR-CAT-05) — a staff request carrying it would be a named 403.
 * `photoUrls` = the photos AFTER Save uploaded the chosen files.
 */
function toCreateDressRequest(
  values: DressFormValues,
  photoUrls: string[],
  isOwner: boolean,
): CreateDressRequestDto {
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
function toUpdateDressRequest(
  values: DressFormValues,
  photoUrls: string[],
  isOwner: boolean,
): UpdateDressRequestDto {
  return {
    code: values.code,
    name: values.name,
    sizeLabel: values.sizeLabel ? values.sizeLabel : null,
    rentalPrice: Number(values.rentalPrice),
    depositAmount: Number(values.depositAmount),
    notes: values.notes ? values.notes : null,
    photoUrls,
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
  const sizeLabelId = useId();
  const photosLabelId = useId();
  // Chosen photos reach storage only on Save, all in one batch (catalog/dress-photo-upload §9).
  const uploadPhotos = usePhotoUploader();
  /** Per-photo % while Save uploads; null = not uploading. */
  const [uploadProgress, setUploadProgress] = useState<Record<string, number> | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

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
  const { reset, getValues } = form;
  useEffect(() => {
    if (!open) return;
    revokePhotoPreviews(getValues('photos'));
    reset(dress ? toFormValues(dress) : dressFormDefaults);
  }, [open, dress, reset, getValues]);

  // Unmount: stop any upload still running and release the local previews.
  useEffect(
    () => () => {
      uploadAbort.current?.abort();
      revokePhotoPreviews(getValues('photos'));
    },
    [getValues],
  );

  function closeDialog() {
    // Closing while Save uploads abandons it: the PUTs stop and the dress is not saved.
    uploadAbort.current?.abort();
    revokePhotoPreviews(form.getValues('photos'));
    form.reset();
    onOpenChange(false);
  }

  /** True from the moment the dress POST/PATCH is sent until it settles. */
  const dressRequestInFlight = useRef(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    // A sent dress request cannot be taken back — dismissing now would still save the dress, so
    // Cancel, ✕ and Escape wait for the answer (the answer itself closes via closeDialog).
    if (dressRequestInFlight.current) return;
    closeDialog();
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
      onSettled: () => {
        dressRequestInFlight.current = false;
      },
      onSuccess: async () => {
        await invalidateDressQueries();
        toast.success(t('form.success'));
        closeDialog();
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
      onSettled: () => {
        dressRequestInFlight.current = false;
      },
      onSuccess: async () => {
        await invalidateDressQueries();
        toast.success(t('form.updateSuccess'));
        closeDialog();
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
            closeDialog();
            return;
          default:
            toast.error(t('form.updateError'));
        }
      },
    },
  });

  /**
   * Save step 1 (§9): upload every chosen file in one batch. Uploaded photos turn into URLs in the
   * form right away, so a later Save (after a failed photo or a rejected dress) never uploads them
   * twice. Resolves the photos to send, or null = do not save the dress.
   */
  async function uploadChosenPhotos(photos: PhotoItem[]): Promise<PhotoItem[] | null> {
    if (!photos.some((photo) => photo.kind === 'local')) return photos;
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploadProgress({});
    try {
      const result = await uploadLocalPhotos(photos, uploadPhotos, {
        signal: controller.signal,
        onProgress: (id, percent) =>
          setUploadProgress((prev) => (prev ? { ...prev, [id]: percent } : prev)),
      });
      if (controller.signal.aborted) return null; // the dialog was closed — nobody is looking
      form.setValue('photos', result.items);
      if (!result.ok) {
        toast.error(t('form.photoUploadFailed'));
        return null;
      }
      return result.items;
    } finally {
      if (uploadAbort.current === controller) uploadAbort.current = null;
      setUploadProgress(null);
    }
  }

  // Save is disabled while submitting; handleSubmit also ignores a second Enter meanwhile.
  const onSubmit = form.handleSubmit(async (values) => {
    const photos = await uploadChosenPhotos(values.photos);
    if (!photos) return;
    const photoUrls = photoUrlsOf(photos);
    dressRequestInFlight.current = true;
    if (dress) {
      updateDress.mutate({ id: dress.id, data: toUpdateDressRequest(values, photoUrls, isOwner) });
    } else {
      createDress.mutate({ data: toCreateDressRequest(values, photoUrls, isOwner) });
    }
  });

  const dressPending = createDress.isPending || updateDress.isPending;
  const saving = form.formState.isSubmitting || dressPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Scrolls on a short screen (kernel cap, cms-mobile-ux D4): the photo grid can add rows. */}
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
                  <FormLabel id={sizeLabelId}>{t('form.fields.sizeLabel')}</FormLabel>
                  <FormControl>
                    {/* Buttons, not a text field (FR-CAT-08): the shop stocks five sizes. */}
                    <SizeOptionGroup
                      value={field.value}
                      onChange={field.onChange}
                      aria-labelledby={sizeLabelId}
                    />
                  </FormControl>
                  <FormDescription>{t('form.sizeHint')}</FormDescription>
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
              name="photos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id={photosLabelId}>{t('form.fields.photoUrls')}</FormLabel>
                  <PhotoListField
                    value={field.value}
                    onChange={field.onChange}
                    progress={uploadProgress}
                    aria-labelledby={photosLabelId}
                  />
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
                <Button type="button" variant="outline" disabled={dressPending}>
                  {tCommon('actions.cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {uploadProgress ? t('form.uploadingPhotos') : tCommon('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

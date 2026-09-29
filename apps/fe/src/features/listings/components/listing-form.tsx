import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { mapApiError } from '@/api/errors';
import {
  useCreateListingHttpControllerCreate,
  useUpdateListingHttpControllerUpdate,
} from '@/api/generated/catalog/catalog';
import type {
  CreateListingRequestDto,
  ListingDto,
  ListingSpecsRequestDto,
  UpdateListingRequestDto,
} from '@/api/generated/model';
import { usePhotoUploader } from '@/api/use-photo-uploader';
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

import { useRefreshListings } from '../hooks/use-refresh-listings';
import { slugify } from '../lib/slugify';
import {
  listingFormDefaults,
  listingFormSchema,
  type ListingFormValues,
} from '../schemas/listing-form.schema';
import { ListingFormMessage } from './listing-form-message';
import { StylePicker } from './style-picker';

function toFormValues(listing: ListingDto): ListingFormValues {
  return {
    name: listing.name,
    slug: listing.slug,
    tagline: listing.tagline,
    description: listing.description,
    styles: [...listing.styles],
    retailPrice: listing.retailPrice === null ? '' : String(listing.retailPrice),
    material: listing.specs.material ?? '',
    silhouette: listing.specs.silhouette ?? '',
    length: listing.specs.length ?? '',
    color: listing.specs.color ?? '',
    stylesText: listing.specs.stylesText ?? '',
    photos: toPhotoItems(listing.photoUrls),
    isHot: listing.isHot,
  };
}

/** Blank spec cells are explicit nulls: the API refuses an empty string (minLength 1). */
function toSpecs(values: ListingFormValues): ListingSpecsRequestDto {
  const cell = (value: string) => (value ? value : null);
  return {
    material: cell(values.material),
    silhouette: cell(values.silhouette),
    length: cell(values.length),
    color: cell(values.color),
    stylesText: cell(values.stylesText),
  };
}

/** Create: a blank slug is omitted — the server derives it from the name (the same slugify). */
function toCreateRequest(values: ListingFormValues, photoUrls: string[]): CreateListingRequestDto {
  return {
    name: values.name,
    ...(values.slug ? { slug: values.slug } : {}),
    tagline: values.tagline,
    description: values.description,
    styles: values.styles,
    retailPrice: values.retailPrice ? Number(values.retailPrice) : null,
    specs: toSpecs(values),
    photoUrls,
    isHot: values.isHot,
  };
}

/**
 * Update sends the whole form, EXCEPT the slug unless it actually changed: an unchanged slug is not
 * a change, and on a listing that was ever published any slug in the body is the refused act (R2).
 */
function toUpdateRequest(
  values: ListingFormValues,
  photoUrls: string[],
  listing: ListingDto,
): UpdateListingRequestDto {
  const slugChanged = values.slug !== '' && values.slug !== listing.slug;
  return {
    name: values.name,
    ...(slugChanged && listing.firstPublishedAt === null ? { slug: values.slug } : {}),
    tagline: values.tagline,
    description: values.description,
    styles: values.styles,
    retailPrice: values.retailPrice ? Number(values.retailPrice) : null,
    specs: toSpecs(values),
    photoUrls,
    isHot: values.isHot,
  };
}

interface ListingFormProps {
  /** When set, the form edits this listing; otherwise it creates one. */
  listing?: ListingDto;
}

/**
 * The listing's public content (spec §3 form). ONE component for /website/new and /website/:id.
 * Save = (1) upload every chosen photo in one batch (catalog/dress-photo-upload §9), (2) only when
 * all uploaded, send the create/update. Every rejection keeps the form and lands where it belongs.
 */
export function ListingForm({ listing }: ListingFormProps) {
  const { t } = useTranslation('listings');
  const navigate = useNavigate();
  const refreshListings = useRefreshListings();
  const uploadPhotos = usePhotoUploader();
  const stylesLabelId = useId();
  const photosLabelId = useId();
  const [uploadProgress, setUploadProgress] = useState<Record<string, number> | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  /** The slug the server said is taken — interpolated into the field error. */
  const [takenSlug, setTakenSlug] = useState('');
  /** Create only: the slug follows the name until staff type their own. */
  const slugEdited = useRef(listing !== undefined);

  const slugLocked = listing !== undefined && listing.firstPublishedAt !== null;

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: listing ? toFormValues(listing) : listingFormDefaults,
  });
  const { getValues } = form;

  // Leaving the page while Save uploads abandons it; local previews are released either way.
  useEffect(
    () => () => {
      uploadAbort.current?.abort();
      revokePhotoPreviews(getValues('photos'));
    },
    [getValues],
  );

  const dressIds = listing?.dresses.map((dress) => dress.id) ?? [];

  /** The listing vanished under us: nothing left to edit (ADR 0001 §4 → back to /website). */
  async function leaveBecauseNotFound(): Promise<void> {
    toast.error(t('errors.notFound'));
    void navigate('/website');
    await refreshListings({ dressIds });
  }

  async function handleRejection(error: unknown): Promise<void> {
    const mapped = mapApiError(error);
    if (mapped.kind !== 'outcome') {
      toast.error(t('form.error'));
      return;
    }
    switch (mapped.status) {
      case 'rejected_listing_slug_taken':
        setTakenSlug(typeof mapped.slug === 'string' ? mapped.slug : getValues('slug'));
        form.setError('slug', { message: 'errors.slugTaken' }, { shouldFocus: true });
        return;
      case 'rejected_listing_slug_locked':
        // Published by someone else meanwhile: the refetch turns the slug field read-only.
        form.setError('slug', { message: 'errors.slugLocked' });
        if (listing) await refreshListings({ listingId: listing.id });
        return;
      case 'rejected_listing_photo_required':
        form.setError('photos', { message: 'errors.photoRequired' });
        return;
      case 'rejected_listing_not_found':
        await leaveBecauseNotFound();
        return;
      default:
        toast.error(t('form.error'));
    }
  }

  // Empty onError: every failure is rendered by handleRejection (overrides the global toast).
  const createListing = useCreateListingHttpControllerCreate({
    mutation: { onError: () => undefined },
  });
  const updateListing = useUpdateListingHttpControllerUpdate({
    mutation: { onError: () => undefined },
  });

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
      if (controller.signal.aborted) return null;
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

  const onSubmit = form.handleSubmit(async (values) => {
    const photos = await uploadChosenPhotos(values.photos);
    if (!photos) return;
    const photoUrls = photoUrlsOf(photos);
    try {
      if (listing) {
        await updateListing.mutateAsync({
          id: listing.id,
          data: toUpdateRequest(values, photoUrls, listing),
        });
        await refreshListings({ listingId: listing.id, dressIds });
        // The saved state is the new baseline; uploaded photos are URLs now.
        form.reset({ ...values, photos });
        toast.success(t('form.updateSuccess'));
      } else {
        const created = await createListing.mutateAsync({
          data: toCreateRequest(values, photoUrls),
        });
        await refreshListings({});
        toast.success(t('form.createSuccess'));
        // Dresses attach on the listing's own page — it needs an id first.
        void navigate(`/website/${created.id}`, { replace: true });
      }
    } catch (error) {
      await handleRejection(error);
    }
  });

  const saving = form.formState.isSubmitting;
  const retailPrice = useWatch({ control: form.control, name: 'retailPrice' });

  return (
    <Form {...form}>
      <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.fields.name')}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    if (!slugEdited.current) {
                      form.setValue('slug', slugify(event.target.value));
                    }
                  }}
                />
              </FormControl>
              <ListingFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.fields.slug')}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  readOnly={slugLocked}
                  aria-readonly={slugLocked}
                  {...field}
                  onChange={(event) => {
                    slugEdited.current = true;
                    field.onChange(event);
                  }}
                />
              </FormControl>
              <FormDescription>
                {slugLocked ? t('form.slugLocked') : t('form.slugHint')}
              </FormDescription>
              <ListingFormMessage values={{ slug: takenSlug }} />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tagline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.fields.tagline')}</FormLabel>
              <FormControl>
                <Input autoComplete="off" {...field} />
              </FormControl>
              <ListingFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.fields.description')}</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} />
              </FormControl>
              <ListingFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="styles"
          render={({ field }) => (
            <FormItem>
              <FormLabel id={stylesLabelId}>{t('form.fields.styles')}</FormLabel>
              <FormControl>
                <StylePicker
                  value={field.value}
                  onChange={field.onChange}
                  aria-labelledby={stylesLabelId}
                />
              </FormControl>
              <ListingFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="retailPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.fields.retailPrice')}</FormLabel>
              <FormControl>
                <Input inputMode="numeric" autoComplete="off" {...field} />
              </FormControl>
              <FormDescription>
                {/^[0-9]+$/.test(retailPrice.trim())
                  ? formatVnd(Number(retailPrice.trim()))
                  : t('form.retailPriceHint')}
              </FormDescription>
              <ListingFormMessage />
            </FormItem>
          )}
        />
        <fieldset className="grid gap-4 rounded-lg border p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium">{t('form.fields.specs.title')}</legend>
          {(['material', 'silhouette', 'length', 'color', 'stylesText'] as const).map(
            (name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`form.fields.specs.${name}`)}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <ListingFormMessage />
                  </FormItem>
                )}
              />
            ),
          )}
        </fieldset>
        <FormField
          control={form.control}
          name="photos"
          render={({ field }) => (
            <FormItem>
              <FormLabel id={photosLabelId}>{t('form.fields.photos')}</FormLabel>
              <PhotoListField
                value={field.value}
                onChange={field.onChange}
                progress={uploadProgress}
                aria-labelledby={photosLabelId}
              />
              <ListingFormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isHot"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormControl>
                  <input
                    type="checkbox"
                    role="switch"
                    className="size-5 accent-primary"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormLabel>{t('form.fields.isHot')}</FormLabel>
              </div>
              <FormDescription>{t('form.isHotHint')}</FormDescription>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void navigate('/website')}
          >
            {t('form.back')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {uploadProgress
              ? t('form.uploadingPhotos')
              : listing
                ? t('form.save')
                : t('form.create')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

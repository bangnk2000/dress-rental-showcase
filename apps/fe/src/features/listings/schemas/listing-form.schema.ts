/**
 * FORM schema for a public listing (docs/design/catalog/public-listing.md §2 business input) —
 * validates the FORM, not the contract. Messages are i18n KEYS in the `listings` namespace,
 * resolved by ListingFormMessage. The price stays a string (text input); the form maps it to the
 * integer the request expects.
 */
import { z } from 'zod';

import {
  isRejectedPhoto,
  isValidPhotoLink,
  type PhotoItem,
} from '@/components/media/photo-items';
import { MAX_PHOTOS } from '@/components/media/photo-upload-rules';

import { LISTING_SLUG_MAX_LENGTH, LISTING_SLUG_PATTERN } from '../lib/slugify';
import { STYLES, type Style } from '../lib/styles';

const spec = z.string().trim().max(120, 'form.errors.specTooLong');

export const listingFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'form.errors.nameRequired')
    .max(120, 'form.errors.nameTooLong'),
  /** '' on create = let the server derive it from the name (the field shows the same derivation). */
  slug: z
    .string()
    .trim()
    .max(LISTING_SLUG_MAX_LENGTH, 'form.errors.slugInvalid')
    .refine((slug) => slug === '' || LISTING_SLUG_PATTERN.test(slug), 'form.errors.slugInvalid'),
  tagline: z.string().trim().max(160, 'form.errors.taglineTooLong'),
  description: z.string().trim().max(2000, 'form.errors.descriptionTooLong'),
  styles: z
    .array(z.custom<Style>((value) => STYLES.includes(value as Style)))
    .min(1, 'form.errors.stylesRequired'),
  retailPrice: z.string().trim().regex(/^[0-9]*$/, 'form.errors.amountInvalid'),
  material: spec,
  silhouette: spec,
  length: spec,
  color: spec,
  stylesText: spec,
  /** Same rules as the dress form: stored URLs + chosen files that Save uploads first. */
  photos: z
    .array(z.custom<PhotoItem>())
    .refine((photos) => photos.length <= MAX_PHOTOS, 'form.errors.photoUrlsTooMany')
    .refine((photos) => photos.every(isValidPhotoLink), 'form.errors.photoUrlInvalid')
    .refine((photos) => !photos.some(isRejectedPhoto), 'form.errors.photoInvalid'),
  isHot: z.boolean(),
});

export type ListingFormValues = z.infer<typeof listingFormSchema>;

export const listingFormDefaults: ListingFormValues = {
  name: '',
  slug: '',
  tagline: '',
  description: '',
  styles: [],
  retailPrice: '',
  material: '',
  silhouette: '',
  length: '',
  color: '',
  stylesText: '',
  photos: [],
  isHot: false,
};

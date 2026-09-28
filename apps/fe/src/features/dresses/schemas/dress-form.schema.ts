/**
 * FORM schema (03-ui-layer.md §4) — validates the FORM, not the contract.
 * Messages are i18n KEYS in the `dresses` namespace, resolved at render time
 * by DressFormMessage. Amount fields stay strings here (they come from text
 * inputs); the dialog maps them to the integers CreateDressRequestDto expects
 * in onSubmit — form shape ≠ request shape is normal.
 */
import { z } from 'zod';

import {
  isRejectedPhoto,
  isValidPhotoLink,
  type PhotoItem,
} from '@/components/media/photo-items';
import { MAX_PHOTOS } from '@/components/media/photo-upload-rules';

const vndAmount = (requiredKey: string) =>
  z
    .string()
    .trim()
    .min(1, requiredKey)
    .regex(/^[0-9]+$/, 'form.errors.amountInvalid');


export const dressFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'form.errors.codeRequired')
    // Mirrors the CreateDressRequestDto @pattern for shop codes (underscore = duplicate suffix).
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,19}$/, 'form.errors.codeInvalid'),
  name: z
    .string()
    .trim()
    .min(1, 'form.errors.nameRequired')
    .max(200, 'form.errors.nameTooLong'),
  sizeLabel: z.string().trim().max(20, 'form.errors.sizeTooLong'),
  rentalPrice: vndAmount('form.errors.rentalPriceRequired'),
  depositAmount: vndAmount('form.errors.depositRequired'),
  notes: z.string().trim().max(2000, 'form.errors.notesTooLong'),
  /**
   * Photos in display order (first = cover): stored URLs (R2 or pasted) and chosen files that Save
   * uploads first (catalog/dress-photo-upload §9). PhotoListField already refuses bad links and an
   * 11th photo; this mirrors the API (`@ArrayMaxSize(10)`, http(s) URLs) and holds Save while a
   * file that no upload can fix (wrong type / too large) is still in the list. Array-level
   * refinements keep the message on the field, not on a hidden item path.
   */
  photos: z
    .array(z.custom<PhotoItem>())
    .refine((photos) => photos.length <= MAX_PHOTOS, 'form.errors.photoUrlsTooMany')
    .refine((photos) => photos.every(isValidPhotoLink), 'form.errors.photoUrlInvalid')
    .refine((photos) => !photos.some(isRejectedPhoto), 'form.errors.photoInvalid'),
  /** Category id, or the NONE sentinel — Radix Select items cannot carry an empty value. */
  categoryId: z.string(),
  /** Owner-only (FR-CAT-05); '' = no value. The dialog only SENDS it for the owner. */
  purchasePrice: z.string().trim().regex(/^[0-9]*$/, 'form.errors.amountInvalid'),
});

export const CATEGORY_NONE = 'none';

/**
 * The five sizes the shop stocks — the form offers these as buttons (FR-CAT-08). Stored as the
 * label itself; the API keeps `sizeLabel` free text, so older rows (CSV import) may hold others.
 */
export const SIZE_OPTIONS: readonly string[] = ['XS', 'S', 'M', 'L', 'XL'];

/** The code a duplicate is numbered from (mirrors DressCode.baseOf on the API). */
export function duplicateBaseOf(code: string): string {
  return code.replace(/_[0-9]+$/, '');
}

export type DressFormValues = z.infer<typeof dressFormSchema>;

export const dressFormDefaults: DressFormValues = {
  code: '',
  name: '',
  sizeLabel: '',
  rentalPrice: '',
  depositAmount: '',
  notes: '',
  photos: [],
  categoryId: CATEGORY_NONE,
  purchasePrice: '',
};

/**
 * FORM schema (03-ui-layer.md §4) — validates the FORM, not the contract.
 * Messages are i18n KEYS in the `dresses` namespace, resolved at render time
 * by DressFormMessage. Amount fields stay strings here (they come from text
 * inputs); the dialog maps them to the integers CreateDressRequestDto expects
 * in onSubmit — form shape ≠ request shape is normal.
 */
import { z } from 'zod';

const vndAmount = (requiredKey: string) =>
  z
    .string()
    .trim()
    .min(1, requiredKey)
    .regex(/^[0-9]+$/, 'form.errors.amountInvalid');

const PHOTO_URL_LINE = /^https?:\/\/\S+$/;

/** Textarea value (one link per line) → cleaned URL list. */
export function parsePhotoUrls(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export const dressFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'form.errors.codeRequired')
    // Mirrors the CreateDressRequestDto @pattern for shop codes.
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/, 'form.errors.codeInvalid'),
  name: z
    .string()
    .trim()
    .min(1, 'form.errors.nameRequired')
    .max(200, 'form.errors.nameTooLong'),
  sizeLabel: z.string().trim().max(20, 'form.errors.sizeTooLong'),
  rentalPrice: vndAmount('form.errors.rentalPriceRequired'),
  depositAmount: vndAmount('form.errors.depositRequired'),
  notes: z.string().trim().max(2000, 'form.errors.notesTooLong'),
  photoUrls: z
    .string()
    .refine((value) => parsePhotoUrls(value).length <= 10, 'form.errors.photoUrlsTooMany')
    .refine(
      (value) => parsePhotoUrls(value).every((line) => PHOTO_URL_LINE.test(line)),
      'form.errors.photoUrlInvalid',
    ),
  /** Category id, or the NONE sentinel — Radix Select items cannot carry an empty value. */
  categoryId: z.string(),
});

export const CATEGORY_NONE = 'none';

export type DressFormValues = z.infer<typeof dressFormSchema>;

export const dressFormDefaults: DressFormValues = {
  code: '',
  name: '',
  sizeLabel: '',
  rentalPrice: '',
  depositAmount: '',
  notes: '',
  photoUrls: '',
  categoryId: CATEGORY_NONE,
};

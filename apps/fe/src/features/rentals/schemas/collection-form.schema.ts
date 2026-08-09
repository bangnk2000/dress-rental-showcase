/**
 * FORM schema (03-ui-layer.md §4) — validates the FORM, not the contract.
 * Messages are i18n KEYS in the `rentals` namespace, resolved at render time by
 * RentalFormMessage. Amounts stay strings here (text inputs); the dialog maps the non-blank ones
 * to the integers RecordCollectionRequestDto expects.
 */
import { z } from 'zod';

const optionalVnd = z
  .string()
  .trim()
  .regex(/^[0-9]*$/, 'collect.errors.amountInvalid');

export const collectionFormSchema = z.object({
  deposit: optionalVnd,
  rentalFee: optionalVnd,
  note: z.string().trim().max(2000, 'collect.errors.noteTooLong'),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export const collectionFormDefaults: CollectionFormValues = {
  deposit: '',
  rentalFee: '',
  note: '',
};

/**
 * FORM schema (03-ui-layer.md §4) — validates the FORM, not the contract.
 * Messages are i18n KEYS in the `today` namespace, resolved at render time by
 * TodayFormMessage. Amounts stay strings here (text inputs); the dialog maps
 * the non-blank ones to the integers ReturnRentalRequestDto expects.
 */
import { z } from 'zod';

const optionalVnd = z
  .string()
  .trim()
  .regex(/^[0-9]*$/, 'returnDialog.errors.amountInvalid');

export const returnFormSchema = z.object({
  lateFee: optionalVnd,
  damageFee: optionalVnd,
  depositRefund: optionalVnd,
  note: z.string().trim().max(2000, 'returnDialog.errors.noteTooLong'),
});

export type ReturnFormValues = z.infer<typeof returnFormSchema>;

export const returnFormDefaults: ReturnFormValues = {
  lateFee: '',
  damageFee: '',
  depositRefund: '',
  note: '',
};

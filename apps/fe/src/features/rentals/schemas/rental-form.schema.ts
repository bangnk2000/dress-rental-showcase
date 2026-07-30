/**
 * FORM schema (03-ui-layer.md §4) — validates the FORM, not the contract.
 * Messages are i18n KEYS in the `rentals` namespace, resolved at render time
 * by RentalFormMessage. Dates come from native date inputs as `yyyy-mm-dd`
 * strings — the same shape CreateRentalRequestDto expects. The selected
 * dresses live OUTSIDE this schema (component state; see NewRentalRoute).
 */
import { z } from 'zod';

export const rentalFormSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(1, 'form.errors.customerNameRequired')
      .max(200, 'form.errors.customerNameTooLong'),
    customerPhone: z
      .string()
      .trim()
      .min(1, 'form.errors.phoneRequired')
      // Mirrors the CreateRentalRequestDto @pattern.
      .regex(/^[0-9+ ().-]{6,20}$/, 'form.errors.phoneInvalid'),
    startDate: z.string().min(1, 'form.errors.startDateRequired'),
    endDate: z.string().min(1, 'form.errors.endDateRequired'),
    notes: z.string().trim().max(2000, 'form.errors.notesTooLong'),
  })
  .refine(
    (values) =>
      values.startDate === '' || values.endDate === '' || values.startDate <= values.endDate,
    { path: ['endDate'], message: 'form.errors.endBeforeStart' },
  );

export type RentalFormValues = z.infer<typeof rentalFormSchema>;

export const rentalFormDefaults: RentalFormValues = {
  customerName: '',
  customerPhone: '',
  startDate: '',
  endDate: '',
  notes: '',
};

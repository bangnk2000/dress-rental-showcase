import { z } from 'zod';

/**
 * The `payments` row. There is no `updated_at` column on purpose: a movement is written once and
 * never edited (FR-PAY-02 R6), so the aggregate's updatedAt never reaches the table.
 */
export const paymentSchema = z.object({
  id: z.string(),
  rental_id: z.string(),
  kind: z.enum([
    'deposit',
    'deposit_refund',
    'rental_fee',
    'rental_fee_refund',
    'late_fee',
    'damage_fee',
  ]),
  amount: z.number().int(),
  note: z.string().nullable(),
  created_at: z.union([z.number(), z.string(), z.date()]),
});

export type PaymentModel = z.infer<typeof paymentSchema>;

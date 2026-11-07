import { z } from 'zod';

export const rentalRowSchema = z.object({
  id: z.string(),
  customer_name: z.string(),
  customer_phone: z.string(),
  period: z.string(), // daterange literal, e.g. [2026-08-01,2026-08-04)
  status: z.enum(['booked', 'out', 'returned', 'cancelled']),
  notes: z.string().nullable(),
  discount_amount: z.number().int(),
  cancel_reason: z.string().nullable(),
  created_at: z.union([z.number(), z.string(), z.date()]),
  updated_at: z.union([z.number(), z.string(), z.date()]),
});

export const rentalItemRowSchema = z.object({
  id: z.string(),
  rental_id: z.string(),
  dress_id: z.string(),
  price: z.number().int(),
  blocked_period: z.string(),
  blocking: z.boolean(),
});

/** The aggregate spans two tables — the repository reads/writes them as one unit. */
export const rentalAggregateSchema = z.object({
  rental: rentalRowSchema,
  items: z.array(rentalItemRowSchema),
});

export type RentalRow = z.infer<typeof rentalRowSchema>;
export type RentalItemRow = z.infer<typeof rentalItemRowSchema>;
export type RentalModel = z.infer<typeof rentalAggregateSchema>;

import { z } from 'zod';

export const dressSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  size_label: z.string().nullable(),
  rental_price: z.number().int(),
  deposit_amount: z.number().int(),
  status: z.enum(['active', 'retired']),
  notes: z.string().nullable(),
  photo_urls: z.array(z.string()),
  created_at: z.union([z.number(), z.string(), z.date()]),
  updated_at: z.union([z.number(), z.string(), z.date()]),
});

export type DressModel = z.infer<typeof dressSchema>;

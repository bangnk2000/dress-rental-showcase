import { z } from 'zod';

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.union([z.number(), z.string(), z.date()]),
  updated_at: z.union([z.number(), z.string(), z.date()]),
});

export type CategoryModel = z.infer<typeof categorySchema>;

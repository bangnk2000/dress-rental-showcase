import { z } from 'zod';

export const qrLinkSchema = z.object({
  id: z.string(),
  target_url: z.string(),
  label: z.string().nullable(),
  created_by_staff_id: z.string(),
  created_at: z.union([z.number(), z.string(), z.date()]),
  updated_at: z.union([z.number(), z.string(), z.date()]),
});

export type QrLinkModel = z.infer<typeof qrLinkSchema>;

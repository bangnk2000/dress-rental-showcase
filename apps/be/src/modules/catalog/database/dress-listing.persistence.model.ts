import { z } from 'zod';

const timestamp = z.union([z.number(), z.string(), z.date()]);

export const dressListingSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  occasions: z.array(z.string()),
  retail_price: z.number().int().nullable(),
  material: z.string().nullable(),
  silhouette: z.string().nullable(),
  length: z.string().nullable(),
  color: z.string().nullable(),
  occasions_text: z.string().nullable(),
  photo_urls: z.array(z.string()),
  is_hot: z.boolean(),
  published_at: timestamp.nullable(),
  first_published_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});

export type DressListingModel = z.infer<typeof dressListingSchema>;

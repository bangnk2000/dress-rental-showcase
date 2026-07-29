import { z } from 'zod';

export const staffUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['owner', 'staff']),
  password_hash: z.string(),
  created_at: z.union([z.number(), z.string(), z.date()]),
  updated_at: z.union([z.number(), z.string(), z.date()]),
});

export type StaffUserModel = z.infer<typeof staffUserSchema>;

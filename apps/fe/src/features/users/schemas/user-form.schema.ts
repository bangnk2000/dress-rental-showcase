import { z } from 'zod';

/** Messages are i18n KEYS in the `users` namespace, resolved at render (init-react 06 §2). */
export const createUserSchema = z.object({
  username: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/, { error: 'validation.usernameShape' }),
  name: z.string().min(1, { error: 'validation.nameRequired' }).max(100),
  password: z.string().min(8, { error: 'validation.passwordMin' }),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, { error: 'validation.passwordMin' }),
});

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export type UserFormMessageKey =
  | 'validation.usernameShape'
  | 'validation.usernameTaken' // set imperatively from the rejected_username_taken outcome
  | 'validation.nameRequired'
  | 'validation.passwordMin';

import { z } from 'zod';

/**
 * Validation messages are i18n KEYS in the `auth` namespace, resolved at
 * render time (docs/spec/init-react/06-i18n.md §2) — never literal copy.
 */
export const loginFormSchema = z.object({
  email: z.email({ error: 'validation.emailInvalid' }),
  password: z.string().min(1, { error: 'validation.passwordRequired' }),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

/** Every message key the schema can emit — types the render-side t() call. */
export type LoginFormMessageKey =
  | 'validation.emailInvalid'
  | 'validation.passwordRequired';

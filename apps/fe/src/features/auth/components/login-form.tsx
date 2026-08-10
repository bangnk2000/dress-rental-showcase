import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { outcomeStatus } from '@/api/errors';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useFormField,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import {
  loginFormSchema,
  type LoginFormMessageKey,
  type LoginFormValues,
} from '../schemas/login-form.schema';
import { useSession } from '../use-session';

type LoginErrorKey = 'errors.invalidCredentials' | 'errors.generic';

/**
 * Field-level message: the schema emits i18n KEYS as messages; this resolves
 * them through t() at render (the vendored FormMessage renders raw strings).
 */
function FieldMessage() {
  const { t } = useTranslation('auth');
  const { error, formMessageId } = useFormField();
  const key = error?.message as LoginFormMessageKey | undefined;
  if (!key) return null;
  return (
    <p id={formMessageId} data-slot="form-message" className="text-sm text-destructive">
      {t(key)}
    </p>
  );
}

export function LoginForm() {
  const { t } = useTranslation('auth');
  const { signIn } = useSession();
  const [errorKey, setErrorKey] = useState<LoginErrorKey | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setErrorKey(null);
    try {
      await signIn(values);
      // Redirect happens declaratively: the session flip re-renders
      // SignInRoute, which Navigates to `state.from ?? '/'`.
    } catch (error) {
      // Wrong credentials is an OUTCOME, not a 401 — 401 now means only "guard rejected the
      // access token" (ADR 0001 §2).
      setErrorKey(
        outcomeStatus(error) === 'rejected_invalid_credentials'
          ? 'errors.invalidCredentials'
          : 'errors.generic',
      );
    }
  });

  const pending = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email.label')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t('email.placeholder')}
                  {...field}
                />
              </FormControl>
              <FieldMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password.label')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('password.placeholder')}
                  {...field}
                />
              </FormControl>
              <FieldMessage />
            </FormItem>
          )}
        />
        {errorKey ? (
          <p role="alert" className="text-sm text-destructive">
            {t(errorKey)}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}

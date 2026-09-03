import { useTranslation } from 'react-i18next';

import { useFormField } from '@/components/ui/form';

import type { UserFormMessageKey } from '../schemas/user-form.schema';

/** Schema errors carry i18n KEYS; this resolves them through t() at render. */
export function UserFormMessage() {
  const { t } = useTranslation('users');
  const { error, formMessageId } = useFormField();
  const key = error?.message as UserFormMessageKey | undefined;
  if (!key) return null;
  return (
    <p id={formMessageId} data-slot="form-message" className="text-sm text-destructive">
      {t(key)}
    </p>
  );
}

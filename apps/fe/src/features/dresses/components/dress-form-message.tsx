import { useTranslation } from 'react-i18next';

import { useFormField } from '@/components/ui/form';

/**
 * Feature-local replacement for the kernel FormMessage: schema messages are
 * i18n KEYS (03-ui-layer.md §4), resolved through t() here at the render
 * site. The kernel primitive renders messages verbatim and must stay generic,
 * so the feature owns the translation step.
 */
export function DressFormMessage() {
  const { error, formMessageId } = useFormField();
  const { t } = useTranslation('dresses');

  if (!error?.message) return null;

  // The key arrives as a plain string from the schema — widen the typed t()
  // for runtime-resolved keys.
  const translate = t as unknown as (key: string) => string;

  return (
    <p data-slot="form-message" id={formMessageId} className="text-sm text-destructive">
      {translate(error.message)}
    </p>
  );
}

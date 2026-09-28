import { useTranslation } from 'react-i18next';

import { useFormField } from '@/components/ui/form';

/**
 * Feature-local FormMessage: schema and outcome messages are i18n KEYS in the `listings` namespace,
 * translated here. `values` interpolates an outcome payload (the taken `slug`).
 */
export function ListingFormMessage({ values }: { values?: Record<string, string> }) {
  const { error, formMessageId } = useFormField();
  const { t } = useTranslation('listings');

  if (!error?.message) return null;

  const translate = t as unknown as (key: string, options?: Record<string, string>) => string;

  return (
    <p data-slot="form-message" id={formMessageId} className="text-sm text-destructive">
      {translate(error.message, values)}
    </p>
  );
}

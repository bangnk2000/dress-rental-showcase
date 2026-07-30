import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

/** SHELL — fills in when the rentals backend slice ships. */
export function NewRentalRoute() {
  const { t } = useTranslation('rentals');
  return (
    <>
      <PageHeader title={t('newTitle')} />
      <EmptyState title={t('newTitle')} description={t('shell.comingSoon')} />
    </>
  );
}

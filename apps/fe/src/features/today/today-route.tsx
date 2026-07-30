import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

/** SHELL — fills in when the today backend slice ships. */
export function TodayRoute() {
  const { t } = useTranslation('today');
  return (
    <>
      <PageHeader title={t('title')} />
      <EmptyState title={t('title')} description={t('shell.comingSoon')} />
    </>
  );
}

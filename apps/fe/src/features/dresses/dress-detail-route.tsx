import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

/**
 * SHELL — the contract has no get-dress-by-id endpoint yet, so there is
 * nothing to fetch (deliberately NOT fetch-list-and-find). The real detail
 * view (dress info + booked-ranges calendar) arrives with the
 * rentals/availability-check slice.
 */
export function DressDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('dresses');

  return (
    <>
      <PageHeader title={t('detail.title')} description={id} />
      <EmptyState
        title={t('detail.shell.title')}
        description={t('detail.shell.description')}
      />
    </>
  );
}

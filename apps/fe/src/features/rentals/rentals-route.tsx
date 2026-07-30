import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

/** LIST is still a SHELL (awaits a rentals read slice); creating works. */
export function RentalsRoute() {
  const { t } = useTranslation('rentals');
  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild>
            <Link to="/rentals/new">{t('newTitle')}</Link>
          </Button>
        }
      />
      <EmptyState title={t('title')} description={t('shell.comingSoon')} />
    </>
  );
}

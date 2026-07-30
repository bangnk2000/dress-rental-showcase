import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';

export function NotFoundRoute() {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('notFound.title')}
      action={
        <Button asChild variant="outline">
          <Link to="/">{t('notFound.backHome')}</Link>
        </Button>
      }
    />
  );
}

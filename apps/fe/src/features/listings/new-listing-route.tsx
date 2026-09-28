import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/layout/page-header';

import { ListingForm } from './components/listing-form';

/**
 * `/website/new` — the content only. Dresses attach on the listing's own page (`/website/:id`),
 * which Save lands on: the attach endpoint needs the listing's id, and one flow for both screens
 * beats a create that also half-saves a dress set.
 */
export function NewListingRoute() {
  const { t } = useTranslation('listings');
  return (
    <>
      <PageHeader title={t('form.newTitle')} description={t('form.dressesAfterSave')} />
      <ListingForm />
    </>
  );
}

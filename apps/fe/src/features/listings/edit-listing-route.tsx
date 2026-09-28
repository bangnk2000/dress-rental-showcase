import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { useGetListingHttpControllerGetSuspense } from '@/api/generated/catalog/catalog';
import { PageHeader } from '@/components/layout/page-header';

import { ListingActions } from './components/listing-actions';
import { ListingDressesSection } from './components/listing-dresses-section';
import { ListingForm } from './components/listing-form';

export function EditListingRoute() {
  const { id } = useParams<{ id: string }>();
  return id ? <EditListing listingId={id} /> : null;
}

/** `/website/:id` — one GET (content + attached dresses) draws the whole screen (spec §4). */
function EditListing({ listingId }: { listingId: string }) {
  const { t } = useTranslation('listings');
  const { data: listing } = useGetListingHttpControllerGetSuspense(listingId);

  return (
    <>
      <PageHeader title={listing.name} description={t('form.editTitle')} />
      <div className="space-y-8">
        <ListingActions listing={listing} />
        <ListingForm key={listing.id} listing={listing} />
        {/* Re-primed whenever the saved set changes (after a save, or someone else's). */}
        <ListingDressesSection
          key={listing.dresses.map((dress) => dress.id).join(',')}
          listing={listing}
        />
      </div>
    </>
  );
}

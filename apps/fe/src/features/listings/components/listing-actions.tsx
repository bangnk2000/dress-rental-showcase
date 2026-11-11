import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { mapApiError } from '@/api/errors';
import {
  getGetListingHttpControllerGetQueryKey,
  useDeleteListingHttpControllerRemove,
  usePublishListingHttpControllerPublish,
  useUnpublishListingHttpControllerUnpublish,
} from '@/api/generated/catalog/catalog';
import { useMeHttpControllerMe } from '@/api/generated/identity/identity';
import type { ListingDto } from '@/api/generated/model';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { Button } from '@/components/ui/button';

import { useRefreshListings } from '../hooks/use-refresh-listings';
import { listingWebUrl } from '../lib/web-link';
import { listingWebStatus } from '../lib/web-status';
import { ListingStatusBadge } from './listing-status-badge';

/**
 * Publish / hide / delete for one listing, plus its web status and link (spec §3 "published",
 * "xoá"). Every rejection is rendered here; none reaches the global mutation toast.
 */
export function ListingActions({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation('listings');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const refreshListings = useRefreshListings();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Display gate only: the BE decides (R8). The me query is already cached by the session.
  const { data: me } = useMeHttpControllerMe();
  const isOwner = me?.role === 'owner';
  const everPublished = listing.firstPublishedAt !== null;
  const published = listing.publishedAt !== null;
  const staffLocked = !isOwner && everPublished;
  const deleteHintId = useId();
  const dressIds = listing.dresses.map((dress) => dress.id);
  const webUrl = published ? listingWebUrl(listing.slug) : null;

  async function leaveBecauseNotFound(): Promise<void> {
    toast.error(t('errors.notFound'));
    void navigate('/website');
    queryClient.removeQueries({ queryKey: getGetListingHttpControllerGetQueryKey(listing.id) });
    await refreshListings({ dressIds });
  }

  const publish = usePublishListingHttpControllerPublish({
    mutation: {
      onSuccess: async () => {
        await refreshListings({ listingId: listing.id });
        toast.success(t('publish.publishSuccess'));
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome' && mapped.status === 'rejected_listing_not_publishable') {
          const missing = Array.isArray(mapped.missing) ? (mapped.missing as string[]) : [];
          const items = missing.map((item) =>
            item === 'photo'
              ? t('errors.notPublishable.photo')
              : t('errors.notPublishable.activeDress'),
          );
          toast.error(t('errors.notPublishable.title', { missing: items.join(', ') }));
          return;
        }
        if (mapped.kind === 'outcome' && mapped.status === 'rejected_listing_not_found') {
          await leaveBecauseNotFound();
          return;
        }
        toast.error(t('form.error'));
      },
    },
  });

  const unpublish = useUnpublishListingHttpControllerUnpublish({
    mutation: {
      onSuccess: async () => {
        await refreshListings({ listingId: listing.id });
        toast.success(t('publish.unpublishSuccess'));
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (mapped.kind === 'outcome' && mapped.status === 'rejected_listing_not_found') {
          await leaveBecauseNotFound();
          return;
        }
        toast.error(t('form.error'));
      },
    },
  });

  const remove = useDeleteListingHttpControllerRemove({
    mutation: {
      onSuccess: async () => {
        toast.success(t('delete.success'));
        void navigate('/website');
        queryClient.removeQueries({ queryKey: getGetListingHttpControllerGetQueryKey(listing.id) });
        await refreshListings({ dressIds });
      },
      onError: async (error) => {
        const mapped = mapApiError(error);
        if (
          mapped.kind === 'outcome' &&
          mapped.status === 'forbidden' &&
          mapped.reason === 'listing_published_owner_only'
        ) {
          // Published under us: the refetch turns the button into its disabled + tooltip state.
          toast.error(t('errors.deleteOwnerOnly'));
          await refreshListings({ listingId: listing.id });
          return;
        }
        if (mapped.kind === 'outcome' && mapped.status === 'rejected_listing_not_found') {
          await leaveBecauseNotFound();
          return;
        }
        toast.error(t('form.error'));
      },
    },
  });

  const busy = publish.isPending || unpublish.isPending || remove.isPending;
  const status = listingWebStatus(
    listing.publishedAt,
    listing.dresses.some((dress) => dress.status === 'active'),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListingStatusBadge status={status} />
      {webUrl ? (
        <Button asChild variant="link">
          <a href={webUrl} target="_blank" rel="noreferrer">
            {t('publish.viewOnWeb')}
          </a>
        </Button>
      ) : null}
      {published ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => unpublish.mutate({ id: listing.id })}
        >
          {unpublish.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('publish.unpublish')}
        </Button>
      ) : (
        <Button disabled={busy} onClick={() => publish.mutate({ id: listing.id })}>
          {publish.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('publish.publish')}
        </Button>
      )}
      <Button
        variant="destructive"
        disabled={busy || staffLocked}
        aria-describedby={staffLocked ? deleteHintId : undefined}
        onClick={() => setDeleteOpen(true)}
      >
        {t('delete.button')}
      </Button>
      {/* Why the delete is off, as visible text: a hover tooltip never shows on a touch screen
          (cms-mobile-ux). One copy, also the button's accessible description. */}
      {staffLocked ? (
        <span id={deleteHintId} className="text-xs text-muted-foreground">
          {t('delete.staffDisabled')}
        </span>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('delete.title', { name: listing.name })}
        description={
          published ? `${t('delete.publishedWarning')} ${t('delete.confirm')}` : t('delete.confirm')
        }
        confirmLabel={t('delete.button')}
        destructive
        onConfirm={() => {
          setDeleteOpen(false);
          remove.mutate({ id: listing.id });
        }}
      />
    </div>
  );
}

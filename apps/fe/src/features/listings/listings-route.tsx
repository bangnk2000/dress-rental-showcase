import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { useListListingsHttpControllerListSuspense } from '@/api/generated/catalog/catalog';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { PhotoThumbnail } from '@/components/media/photo-thumbnail';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ListingStatusBadge } from './components/listing-status-badge';
import { listingWebStatus } from './lib/web-status';

/**
 * `/website` — the public listings (spec §3). Loading is a table skeleton (own Suspense, so the
 * header stays put); a 5xx/network failure goes to the route boundary's retry.
 */
export function ListingsRoute() {
  const { t } = useTranslation('listings');
  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild>
            <Link to="/website/new">{t('list.create')}</Link>
          </Button>
        }
      />
      <Suspense fallback={<ListingsSkeleton />}>
        <ListingsTable />
      </Suspense>
    </>
  );
}

function ListingsSkeleton() {
  const { t } = useTranslation('listings');
  return (
    <div role="status" aria-label={t('list.loading')} className="space-y-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-md border p-2">
          <Skeleton className="size-10" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ListingsTable() {
  const { t } = useTranslation('listings');
  const navigate = useNavigate();
  const { data } = useListListingsHttpControllerListSuspense();

  if (data.data.length === 0) {
    return (
      <EmptyState
        title={t('list.empty')}
        description={t('list.emptyHint')}
        action={
          <Button asChild>
            <Link to="/website/new">{t('list.create')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">
            <span className="sr-only">{t('list.columns.cover')}</span>
          </TableHead>
          <TableHead>{t('list.columns.name')}</TableHead>
          <TableHead>{t('list.columns.occasions')}</TableHead>
          <TableHead>{t('list.columns.sizes')}</TableHead>
          <TableHead>{t('list.columns.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.data.map((listing) => (
          <TableRow
            key={listing.id}
            className="cursor-pointer"
            onClick={() => void navigate(`/website/${listing.id}`)}
          >
            <TableCell>
              <PhotoThumbnail src={listing.coverUrl} />
            </TableCell>
            <TableCell>
              <Link
                to={`/website/${listing.id}`}
                className="font-medium hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {listing.name}
              </Link>
              {listing.isHot ? (
                <span className="ml-2 text-xs font-medium text-primary">{t('list.hot')}</span>
              ) : null}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {listing.occasions.map((occasion) => t(`occasions.${occasion}`)).join(', ')}
            </TableCell>
            <TableCell className="tabular-nums">
              {t('list.activeSizes', { count: listing.activeSizeCount })}
            </TableCell>
            <TableCell>
              <ListingStatusBadge
                status={listingWebStatus(listing.publishedAt, listing.visibleOnWeb)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

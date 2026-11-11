import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { outcomeStatus } from '@/api/errors';
import {
  getGetDressHttpControllerGetQueryKey,
  getListDressesHttpControllerListQueryKey,
  useGetDressHttpControllerGetSuspense,
  useListCategoriesHttpControllerListSuspense,
  useRetireDressHttpControllerRetire,
} from '@/api/generated/catalog/catalog';
import { useListBookedRangesHttpControllerListSuspense } from '@/api/generated/rentals/rentals';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { formatVnd } from '@/lib/format';
import { PHOTO_WIDTH, photoUrl } from '@/lib/photo-url';

import { AvailabilityChecker } from './components/availability-checker';
import { BookingCalendar } from './components/booking-calendar';
import { PriceHistorySection } from './components/price-history-section';
import { DressFormDialog } from './components/dress-form-dialog';
import { DuplicateDressDialog } from './components/duplicate-dress-dialog';
import { DressStatusBadge } from './components/dress-status-badge';

export function DressDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return id ? <DressDetail dressId={id} /> : null;
}

function DressDetail({ dressId }: { dressId: string }) {
  const { t } = useTranslation('dresses');
  const queryClient = useQueryClient();
  const { data: dress } = useGetDressHttpControllerGetSuspense(dressId);
  const { data: ranges } = useListBookedRangesHttpControllerListSuspense(dressId);
  const [editOpen, setEditOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);

  async function refreshDressQueries(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListDressesHttpControllerListQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDressHttpControllerGetQueryKey(dressId) }),
    ]);
  }

  // Retire is owner-only (guard → 403 envelope for other staff) and one-way in MVP. Both
  // rejections mean the cached detail is stale, so refresh either way (ADR 0001 §4).
  const retireDress = useRetireDressHttpControllerRetire({
    mutation: {
      onSuccess: async () => {
        await refreshDressQueries();
        toast.success(t('detail.retire.success'));
      },
      onError: async (error) => {
        switch (outcomeStatus(error)) {
          case 'rejected_dress_already_retired':
            toast.error(t('detail.retire.alreadyRetired'));
            await refreshDressQueries();
            return;
          case 'rejected_dress_not_found':
            toast.error(t('errors.notFound'));
            await refreshDressQueries();
            return;
          default:
            toast.error(t('detail.retire.error'));
        }
      },
    },
  });

  const { data: categoryList } = useListCategoriesHttpControllerListSuspense();
  const categoryName = dress.categoryId
    ? (categoryList.data.find((category) => category.id === dress.categoryId)?.name ?? '—')
    : t('detail.info.categoryNone');

  const info = [
    { label: t('detail.info.size'), value: dress.sizeLabel ?? '—' },
    { label: t('detail.info.category'), value: categoryName },
    { label: t('detail.info.rentalPrice'), value: formatVnd(dress.rentalPrice) },
    { label: t('detail.info.deposit'), value: formatVnd(dress.depositAmount) },
    // The SERVER decides visibility (FR-CAT-05): staff responses carry no key at all.
    ...(dress.purchasePrice !== undefined
      ? [
          {
            label: t('detail.info.purchasePrice'),
            value:
              dress.purchasePrice === null
                ? t('detail.info.purchasePriceNone')
                : formatVnd(dress.purchasePrice),
          },
        ]
      : []),
    { label: t('detail.info.notes'), value: dress.notes ?? '—' },
  ];

  return (
    <>
      <PageHeader
        title={`${dress.code} — ${dress.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DressStatusBadge status={dress.status} />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              {t('detail.actions.edit')}
            </Button>
            {/* FR-CAT-08: the same model in another size gets its own row, numbered by the server. */}
            <Button variant="outline" onClick={() => setDuplicateOpen(true)}>
              {t('detail.actions.duplicate')}
            </Button>
            {dress.status === 'active' ? (
              <Button
                variant="destructive"
                disabled={retireDress.isPending}
                onClick={() => setRetireOpen(true)}
              >
                {t('detail.actions.retire')}
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-sm font-medium break-words">{item.value}</dd>
            </div>
          ))}
        </dl>
        {/* FR-CAT-09: the public listings this dress is a size of — plain links, no import of the
            listings feature (the URL is the contract). */}
        {dress.listings.length > 0 ? (
          <p className="text-sm">
            <span className="text-muted-foreground">{t('detail.info.listings')}: </span>
            {dress.listings.map((listing, index) => (
              <span key={listing.id}>
                {index > 0 ? ', ' : null}
                <Link to={`/website/${listing.id}`} className="font-medium hover:underline">
                  {listing.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
        {dress.photoUrls.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">{t('detail.photos.title')}</h2>
            <div className="flex flex-wrap gap-2">
              {/* The tile shows the SAME 160 variant as the list (already cached); the link opens
                  the large variant, not the ~2 MB original. Index keys: a dress may list the same
                  link twice. */}
              {dress.photoUrls.map((url, index) => (
                <a
                  key={`${index}-${url}`}
                  href={photoUrl(url, PHOTO_WIDTH.large)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={photoUrl(url, PHOTO_WIDTH.thumbnail)}
                    alt={dress.code}
                    loading="lazy"
                    className="h-28 w-28 rounded-md border object-cover"
                  />
                </a>
              ))}
            </div>
          </section>
        ) : null}
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.calendar.title')}</h2>
          {ranges.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('detail.calendar.empty')}</p>
          ) : null}
          <BookingCalendar ranges={ranges.data} />
        </section>
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{t('detail.checker.title')}</h2>
          <AvailabilityChecker dressId={dressId} />
        </section>
        <PriceHistorySection dressId={dressId} />
      </div>
      {/* Retiring is one-way in the MVP — no endpoint reactivates a dress — so the confirmation
          says which dress and stays in Vietnamese, unlike the browser's own prompt. */}
      <ConfirmDialog
        open={retireOpen}
        onOpenChange={setRetireOpen}
        title={t('detail.retire.title', { code: dress.code })}
        description={t('detail.retire.confirm')}
        confirmLabel={t('detail.actions.retire')}
        destructive
        onConfirm={() => {
          setRetireOpen(false);
          retireDress.mutate({ id: dressId });
        }}
      />
      <DressFormDialog open={editOpen} onOpenChange={setEditOpen} dress={dress} />
      <DuplicateDressDialog open={duplicateOpen} onOpenChange={setDuplicateOpen} dress={dress} />
    </>
  );
}

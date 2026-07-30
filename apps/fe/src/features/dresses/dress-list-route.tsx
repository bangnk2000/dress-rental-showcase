import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListDressesHttpControllerListSuspense } from '@/api/generated/catalog/catalog';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

import { DressFiltersBar } from './components/dress-filters-bar';
import { DressFormDialog } from './components/dress-form-dialog';
import { DressListPagination } from './components/dress-list-pagination';
import { DressTable } from './components/dress-table';
import { useDressFilters } from './hooks/use-dress-filters';

/**
 * Catalog screen. Loading/error surfaces belong to the route boundary
 * (Suspense + error boundary in app/route-boundary.tsx) — the suspense list
 * hook means no isPending branching here.
 */
export function DressListRoute() {
  const { t } = useTranslation('dresses');
  const { q, status, listParams, hasActiveFilters, setSearch, setStatus, setPage } =
    useDressFilters();
  const { data } = useListDressesHttpControllerListSuspense(listParams);
  const [createOpen, setCreateOpen] = useState(false);

  const totalPages = data.limit > 0 ? Math.max(1, Math.ceil(data.count / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>{t('list.createButton')}</Button>
        }
      />
      <div className="space-y-4">
        <DressFiltersBar
          q={q}
          status={status}
          onSearch={setSearch}
          onStatusChange={setStatus}
        />
        {data.count === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              title={t('list.empty.noMatch')}
              description={t('list.empty.noMatchHint')}
            />
          ) : (
            <EmptyState
              title={t('list.empty.noDresses')}
              description={t('list.empty.noDressesHint')}
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  {t('list.createButton')}
                </Button>
              }
            />
          )
        ) : (
          <>
            <DressTable dresses={data.data} />
            {totalPages > 1 ? (
              <DressListPagination
                page={data.page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </div>
      <DressFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

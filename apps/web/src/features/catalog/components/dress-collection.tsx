'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { PublicDressSummary } from '@/api/mock/public-catalog';
import { Link } from '@/i18n/navigation';

import { featuredVisibility, filterDresses, type StyleFilter } from '../lib/filters';
import { DressCard } from './dress-card';
import { StyleChips } from './style-chips';

function DressGrid({ dresses, visibility }: { dresses: PublicDressSummary[]; visibility: (i: number) => string }) {
  const t = useTranslations('catalog.filter');
  if (dresses.length === 0) {
    return <p className="rounded-md bg-surface-container-low p-space-md text-body-md">{t('empty')}</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3.5 md:grid-cols-3 md:gap-gutter xl:grid-cols-4">
      {dresses.map((dress, i) => (
        <DressCard key={dress.slug} dress={dress} className={visibility(i)} />
      ))}
    </ul>
  );
}

/**
 * Home "Bộ Sưu Tập Nổi Bật": chips scroll above the header on mobile, wrap on md, and join the
 * header row on xl. The server hands over 8 dresses; filtering is client-side on that list.
 */
export function FeaturedCollection({ dresses }: { dresses: PublicDressSummary[] }) {
  const t = useTranslations('catalog.featured');
  const [filter, setFilter] = useState<StyleFilter>('all');
  return (
    <section
      id="bo-suu-tap"
      aria-labelledby="featured"
      className="mx-auto mt-space-lg max-w-page scroll-mt-24 px-margin-mobile md:mt-space-xl md:px-space-lg xl:px-margin"
    >
      <div className="mb-space-md flex flex-col gap-space-md xl:flex-row xl:items-end xl:gap-space-lg">
        <div className="order-2 flex items-end justify-between gap-3 xl:contents">
          <div className="xl:order-1">
            <p className="text-label-sm uppercase tracking-widest text-secondary xl:text-label-lg">{t('eyebrow')}</p>
            <h2 id="featured" className="font-display text-headline-sm text-primary md:text-headline-md">
              {t('title')}
            </h2>
          </div>
          <Link
            href="/bo-suu-tap"
            className="hit relative flex shrink-0 items-center gap-0.5 text-label-sm text-primary underline decoration-tertiary-fixed underline-offset-4 xl:order-3 xl:text-label-lg"
          >
            {t('viewAll')} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <StyleChips value={filter} onChange={setFilter} className="order-1 xl:order-2 xl:ml-auto" />
      </div>
      <DressGrid dresses={filterDresses(dresses, filter)} visibility={featuredVisibility} />
    </section>
  );
}

/** /bo-suu-tap: every dress, chips under the page title, no hidden cards. */
export function CatalogBrowser({ dresses }: { dresses: PublicDressSummary[] }) {
  const [filter, setFilter] = useState<StyleFilter>('all');
  return (
    <div className="flex flex-col gap-space-md">
      <StyleChips value={filter} onChange={setFilter} />
      <DressGrid dresses={filterDresses(dresses, filter)} visibility={() => 'flex'} />
    </div>
  );
}

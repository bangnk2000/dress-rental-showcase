'use client';

import { ChevronRight, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import type { PublicDressSummary } from '@/api/public-catalog';
import { Link } from '@/i18n/navigation';

import { useCatalogSearch } from '../hooks/use-catalog-search';
import { featuredVisibility, filterDresses, searchDresses, type StyleFilter } from '../lib/filters';
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
 * Home "Bộ Sưu Tập Nổi Bật": chips are ONE horizontally scrolling row at every width (never wrap),
 * above the header below xl and filling the header row on xl. The server hands over 8 dresses;
 * filtering is client-side on that list.
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
            <h2 id="featured" className="font-display text-headline-sm text-primary md:text-headline-md xl:whitespace-nowrap">
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
        <StyleChips value={filter} onChange={setFilter} scroll className="order-1 xl:order-2 xl:ml-auto xl:flex-1" />
      </div>
      <DressGrid dresses={filterDresses(dresses, filter)} visibility={featuredVisibility} />
    </section>
  );
}

/** /bo-suu-tap: search the full public catalogue, with shareable filters. */
export function CatalogBrowser({ dresses }: { dresses: PublicDressSummary[] }) {
  const t = useTranslations('catalog.search');
  const search = useCatalogSearch();
  const input = useRef<HTMLInputElement>(null);
  const results = searchDresses(filterDresses(dresses, search.style), search.query);
  const filtered = Boolean(search.draftQuery || search.query || search.style !== 'all');
  return (
    <div className="flex flex-col gap-space-md">
      <form role="search" onSubmit={(event) => { event.preventDefault(); search.submit(); }}>
        <label htmlFor="catalog-search" className="mb-2 block text-label-lg text-on-surface">{t('label')}</label>
        <div className="flex items-center gap-2 rounded-full bg-surface-container-high px-4 focus-within:ring-2 focus-within:ring-primary">
          <Search className="h-5 w-5 shrink-0 text-on-surface-variant" aria-hidden />
          <input
            ref={input}
            id="catalog-search"
            type="search"
            value={search.draftQuery}
            onChange={(event) => search.changeQuery(event.target.value)}
            placeholder={t('placeholder')}
            className="hit min-w-0 flex-1 bg-transparent py-3 text-body-md text-on-surface outline-none"
          />
          {search.draftQuery && (
            <button
              type="button"
              aria-label={t('clear')}
              onClick={() => { search.clear(); input.current?.focus(); }}
              className="hit relative shrink-0 rounded-full p-3 text-on-surface-variant hover:bg-secondary-container/50"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      </form>
      <StyleChips value={search.style} onChange={search.changeStyle} />
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-body-md text-on-surface-variant">{t('count', { count: results.length })}</p>
        {filtered && (
          <button
            type="button"
            onClick={() => { search.reset(); input.current?.focus(); }}
            className="hit relative shrink-0 rounded-full px-4 py-2 text-label-sm text-primary underline underline-offset-4"
          >
            {t('reset')}
          </button>
        )}
      </div>
      {results.length ? (
        <DressGrid dresses={results} visibility={() => 'flex'} />
      ) : (
        <p className="rounded-md bg-surface-container-low p-space-md text-body-md text-on-surface">
          {t(dresses.length ? 'empty' : 'catalogEmpty')}
        </p>
      )}
    </div>
  );
}

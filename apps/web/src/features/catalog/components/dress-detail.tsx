import { ChevronLeft, MessageCircle, Phone, Ruler, Shirt, Sparkles, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { PublicDressDetail, PublicDressSpecs } from '@/api/public-catalog';
import { Link } from '@/i18n/navigation';
import { formatVnd } from '@/lib/format';
import { shop } from '@/lib/shop';
import { cn } from '@/lib/utils';

import { badgeClassName } from '../lib/badge';
import { DressGallery } from './dress-gallery';
import { OpenFromMdDetails } from './open-from-md-details';
import { SaveDressButton } from './save-dress-button';

const specKeys = ['material', 'silhouette', 'length', 'color', 'styles'] as const satisfies readonly (keyof PublicDressSpecs)[];

/**
 * Product detail (design/responsive.md §4 Product). No booking: sizes are information, the
 * conversion is Zalo (primary) + call. Mobile swaps the tab bar for a sticky action bar.
 */
export function DressDetail({ dress }: { dress: PublicDressDetail }) {
  const t = useTranslations('catalog');
  const tn = useTranslations('common.nav');
  const tp = useTranslations('common.price');
  // The CMS may leave any spec cell empty — only filled rows render.
  const specs = specKeys.flatMap((key) => {
    const value = dress.specs[key];
    return value ? [[key, value] as const] : [];
  });

  return (
    <>
      <nav
        aria-label={t('detail.breadcrumbLabel')}
        className="mx-auto max-w-page px-margin-mobile py-space-xs md:px-space-lg md:py-space-md xl:px-margin"
      >
        <Link
          href="/bo-suu-tap"
          className="inline-flex min-h-11 items-center gap-1 text-label-lg text-on-surface-variant md:hidden"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {tn('collection')}
        </Link>
        <ol className="hidden items-center gap-1.5 text-body-sm text-outline md:flex">
          <li>
            <Link href="/" className="hit relative hover:text-primary">
              {tn('home')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/bo-suu-tap" className="hit relative hover:text-primary">
              {tn('collection')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-on-surface-variant">
            {dress.name}
          </li>
        </ol>
      </nav>

      <section className="mx-auto max-w-page md:grid md:grid-cols-8 md:gap-x-gutter md:px-space-lg xl:grid-cols-12 xl:px-margin">
        <DressGallery
          images={dress.images}
          overlay={
            <>
              <span
                className={cn(
                  'absolute left-3 top-3 rounded-full px-2.5 py-1 text-label-sm font-semibold',
                  badgeClassName(dress.badge),
                )}
              >
                {t(`badge.${dress.badge}`)}
              </span>
              <SaveDressButton name={dress.name} className="absolute right-3 top-3 h-11 w-11" iconClassName="h-5 w-5" />
            </>
          }
        />

        <div className="px-margin-mobile pt-space-md md:sticky md:top-24 md:col-span-4 md:self-start md:px-0 md:pt-0 xl:top-28 xl:col-span-5 xl:col-start-8">
          <p className="text-label-sm uppercase tracking-widest text-secondary">{dress.styles.map((s) => t(`filter.${s}`)).join(', ')}</p>
          <h1 className="mt-1 font-display text-headline-lg-mobile text-primary md:text-headline-md xl:text-headline-lg">
            {dress.name}
          </h1>
          {dress.codes.length > 0 && (
            <p className="mt-1 text-body-sm text-outline">{t('detail.code', { codes: dress.codes.join(', ') })}</p>
          )}
          <p className="mt-2 whitespace-pre-line text-body-md text-on-surface-variant md:text-body-lg">{dress.description}</p>

          <div className="mt-space-md flex items-baseline gap-2 border-y border-surface-container-highest py-space-sm">
            <span className="font-display text-headline-sm text-primary md:text-headline-md">
              {formatVnd(dress.rentalPrice)}
            </span>
            <span className="text-body-sm text-outline">{tp('perRental')}</span>
            {dress.retailPrice !== null && (
              <span className="ml-auto text-body-sm text-outline-variant line-through">{formatVnd(dress.retailPrice)}</span>
            )}
          </div>

          <div className="mt-space-md">
            <p className="text-label-sm uppercase text-outline">{t('detail.sizesTitle')}</p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label={t('detail.sizesLabel')}>
              {dress.sizes.map((size) => (
                <li
                  key={size.label}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-label-lg',
                    size.available
                      ? 'bg-primary-fixed text-on-primary-fixed'
                      : 'border border-outline-variant text-outline-variant line-through',
                  )}
                >
                  {!size.available && <span className="sr-only">{t('detail.soldOut')} </span>}
                  {size.label}
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
              <Ruler className="h-3.5 w-3.5 text-primary" aria-hidden />
              {t('detail.sizeHelp')}
            </p>
          </div>

          {/* inline actions: md+ only (mobile uses the sticky bar) */}
          <div className="mt-space-lg hidden flex-col gap-space-sm md:flex">
            <a
              href={shop.zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-label-lg text-on-primary shadow-ambient transition-colors hover:bg-primary-hover"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('detail.holdOnZalo')}
            </a>
            <a
              href={`tel:${shop.phone}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-secondary-container px-6 text-label-lg text-primary transition-colors hover:bg-primary-fixed"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {t('detail.call', { phone: shop.phoneDisplay })}
            </a>
          </div>

          <ul className="mt-space-md grid gap-2 rounded-md bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant md:p-space-md">
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {t('detail.perks.fitting')}
            </li>
            <li className="flex items-center gap-2">
              <Shirt className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {t('detail.perks.laundry')}
            </li>
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {t('detail.perks.delivery')}
            </li>
          </ul>

          <div className="mt-space-md divide-y divide-surface-container-highest border-y border-surface-container-highest">
            {specs.length > 0 && (
              <OpenFromMdDetails summary={t('detail.specsTitle')}>
                <dl className="space-y-1.5 pb-space-md text-body-sm">
                  {specs.map(([key, value]) => (
                    <div key={key} className="flex gap-space-md">
                      <dt className="w-20 shrink-0 text-outline">{t(`detail.specs.${key}`)}</dt>
                      <dd className="text-on-surface">{value}</dd>
                    </div>
                  ))}
                </dl>
              </OpenFromMdDetails>
            )}
            <OpenFromMdDetails summary={t('detail.howTitle')}>
              <ol className="list-decimal space-y-1.5 pb-space-md pl-5 text-body-sm text-on-surface-variant">
                <li>{t('detail.how.step1')}</li>
                <li>{t('detail.how.step2')}</li>
                <li>{t('detail.how.step3')}</li>
              </ol>
            </OpenFromMdDetails>
          </div>
        </div>
      </section>
    </>
  );
}

/** Mobile only: replaces the tab bar on the product page (DESIGN.md "sticky booking bars"). */
export function DressActionBar({ dress }: { dress: PublicDressDetail }) {
  const t = useTranslations('catalog.detail');
  const tp = useTranslations('common.price');
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-50 bg-surface/85 shadow-ambient backdrop-blur-lg md:hidden">
      <div className="flex items-center gap-space-sm px-margin-mobile py-space-sm">
        <div className="mr-auto leading-tight">
          <p className="font-display text-title-md text-primary">{formatVnd(dress.rentalPrice)}</p>
          <p className="text-label-sm text-outline">{tp('perRental')}</p>
        </div>
        <a
          href={`tel:${shop.phone}`}
          aria-label={t('call', { phone: shop.phoneDisplay })}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-secondary-container text-primary"
        >
          <Phone className="h-5 w-5" aria-hidden />
        </a>
        <a
          href={shop.zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 text-label-lg text-on-primary"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('holdOnZalo')}
        </a>
      </div>
    </div>
  );
}

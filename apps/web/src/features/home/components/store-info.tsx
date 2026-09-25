import { Clock, Heart, MapPin, Navigation, Phone, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ShopOpenBadge } from '@/components/site/shop-open-badge';
import { shop } from '@/lib/shop';

function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary">
      {children}
    </span>
  );
}

/** mobile: stacked rows · md: 2×2 · xl: one band of 4 cells (design/responsive.md §4 Home). */
export function StoreInfo() {
  const t = useTranslations('home.visit');
  const ts = useTranslations('common.shop');
  return (
    <section
      aria-labelledby="visit"
      className="mx-auto mt-space-lg max-w-page px-margin-mobile md:mt-space-xl md:px-space-lg xl:px-margin"
    >
      <div className="rounded-md bg-surface-container p-space-md md:p-space-lg">
        <div className="mb-space-md flex items-center justify-between gap-3 border-b border-outline-variant/40 pb-space-sm">
          <h2 id="visit" className="flex items-center gap-2 text-title-md text-on-surface md:font-display md:text-headline-sm">
            <Store className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            {t('title')}
          </h2>
          <ShopOpenBadge />
        </div>
        <div className="grid gap-space-md md:grid-cols-2 md:gap-x-space-lg xl:grid-cols-4">
          <div className="flex items-start justify-between gap-3 xl:flex-col xl:justify-start">
            <div className="flex items-start gap-3">
              <IconBadge>
                <MapPin className="h-4 w-4" aria-hidden />
              </IconBadge>
              <div>
                <p className="text-label-sm uppercase text-outline">{t('addressLabel')}</p>
                <p className="text-body-md font-medium text-on-surface">{ts('address')}</p>
              </div>
            </div>
            <a
              href={shop.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hit relative flex shrink-0 items-center gap-1 rounded-full bg-surface-container-lowest px-3 py-1.5 text-label-sm text-primary"
            >
              {t('directions')} <Navigation className="h-3 w-3" aria-hidden />
            </a>
          </div>
          <div className="flex items-center justify-between gap-3 xl:flex-col xl:items-start xl:justify-start">
            <div className="flex items-center gap-3">
              <IconBadge>
                <Phone className="h-4 w-4" aria-hidden />
              </IconBadge>
              <div>
                <p className="text-label-sm uppercase text-outline">{t('hotlineLabel')}</p>
                <p className="text-body-md font-semibold text-primary">{shop.phoneDisplay}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`tel:${shop.phone}`}
                aria-label={t('call', { phone: shop.phoneDisplay })}
                className="hit relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary"
              >
                <Phone className="h-4 w-4" aria-hidden />
              </a>
              <a
                href={shop.zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hit relative rounded-full bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface"
              >
                {t('zalo')}
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <IconBadge>
              <Clock className="h-4 w-4" aria-hidden />
            </IconBadge>
            <div>
              <p className="text-label-sm uppercase text-outline">{t('hoursLabel')}</p>
              <p className="text-body-sm text-on-surface-variant">
                <span className="font-medium text-on-surface">{ts('weekdays')}:</span> {ts('weekdaysHours')}
                <br />
                <span className="font-medium text-on-surface">{ts('weekend')}:</span> {ts('weekendHours')}
              </p>
            </div>
          </div>
          <a
            href={shop.social.find((s) => s.key === 'instagram')?.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-between gap-3 rounded-default bg-surface-container-lowest/80 px-3 py-2 xl:self-start"
          >
            <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
              <Heart className="h-4 w-4 text-secondary" aria-hidden />
              {t('social')}
            </span>
            <span className="text-label-sm font-semibold text-primary">{shop.handle}</span>
          </a>
        </div>
      </div>
    </section>
  );
}

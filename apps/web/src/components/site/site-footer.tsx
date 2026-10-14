import { AtSign, MapPin, Smartphone } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { shop } from '@/lib/shop';
import { cn } from '@/lib/utils';

/**
 * mobile: card · md: card, 2 cols · xl: full-width band, 4 cols. `desktopOnly` = Contact, where
 * below xl the page itself is the contact info (design/responsive.md §4).
 */
export function SiteFooter({ desktopOnly = false }: { desktopOnly?: boolean }) {
  const t = useTranslations('common');
  return (
    <footer
      className={cn(
        'mt-space-lg pb-24 md:mt-space-xl md:pb-space-lg xl:bg-surface-container-low xl:pb-0',
        desktopOnly && 'hidden xl:block',
      )}
    >
      <div className="mx-auto max-w-page px-margin-mobile md:px-space-lg xl:px-margin">
        <div className="grid gap-4 rounded-md bg-surface-container-high/60 p-5 md:grid-cols-2 md:gap-x-space-lg md:p-space-lg xl:grid-cols-4 xl:rounded-none xl:bg-transparent xl:px-0 xl:py-space-xl">
          <div className="flex items-center gap-4 md:row-span-2 md:items-start xl:row-span-1">
            <Image
              src="/images/store.jpg"
              alt={t('shop.storePhotoAlt')}
              width={80}
              height={80}
              className="h-16 w-16 shrink-0 rounded-default object-cover xl:h-20 xl:w-20"
            />
            <div>
              <p className="font-display text-title-md lowercase text-primary">{t('site.name')}</p>
              <p className="text-label-sm uppercase text-secondary">{t('site.taglineCity')}</p>
              <p className="mt-1 text-body-sm text-outline">{t('footer.blurb')}</p>
            </div>
          </div>
          <ul className="space-y-2 border-t border-outline-variant/30 pt-3 text-body-sm text-on-surface-variant md:border-0 md:pt-0">
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {t('shop.address')}
            </li>
            <li className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {t('shop.hotline', { phone: shop.phoneDisplay })}
            </li>
          </ul>
          <div className="hidden text-body-sm text-on-surface-variant xl:block">
            <p className="mb-2 text-label-sm uppercase text-outline">{t('shop.hoursTitle')}</p>
            <p>
              {t('shop.weekdays')}: {t('shop.weekdaysHours')}
            </p>
            <p>
              {t('shop.weekend')}: {t('shop.weekendHours')}
            </p>
          </div>
          <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <AtSign className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t('shop.socialLine', { handle: shop.handle })}
          </p>
        </div>
        <p className="pb-4 pt-2 text-center text-label-sm uppercase tracking-widest text-outline xl:border-t xl:border-outline-variant/40 xl:py-space-md">
          {t('footer.copyright')}
        </p>
      </div>
    </footer>
  );
}

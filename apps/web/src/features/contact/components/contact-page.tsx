import {
  BadgeCheck,
  Camera,
  ChevronRight,
  Clock,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Share2,
  Shirt,
  Sparkles,
  ThumbsUp,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { shop, type SocialKey } from '@/lib/shop';

import { CopyAddressButton } from './copy-address-button';

// lucide v1 ships no brand marks — nearest generic glyphs (apps/web/AGENTS.md: lucide only).
const socialIcons: Record<SocialKey, LucideIcon> = {
  facebook: ThumbsUp,
  instagram: Camera,
  tiktok: Music2,
  zalo: MessageCircle,
};

const privileges = [
  { key: 'fitting', icon: Shirt, tone: 'bg-secondary-container text-on-secondary-container' },
  { key: 'care', icon: Sparkles, tone: 'bg-primary-fixed text-on-primary-fixed' },
  { key: 'delivery', icon: Truck, tone: 'bg-tertiary-fixed text-on-tertiary-fixed' },
] as const;

/**
 * mobile/md: title → photo → CTAs → info (one column) · xl: left col 1–5 (title, CTAs, info) +
 * sticky photo col 7–12 (design/responsive.md §4 Contact).
 */
export function ContactPage() {
  const t = useTranslations('contact');
  const ts = useTranslations('common.shop');

  return (
    <>
      <section className="mx-auto flex max-w-page flex-col gap-space-md px-margin-mobile pt-space-md md:gap-space-lg md:px-space-lg md:pt-space-xl xl:grid xl:grid-cols-12 xl:gap-x-gutter xl:px-margin">
        {/* `contents` below xl so its children interleave with the photo */}
        <div className="contents xl:col-span-5 xl:col-start-1 xl:row-start-1 xl:flex xl:flex-col xl:gap-space-lg">
          <div className="order-1 flex flex-col items-center text-center xl:items-start xl:text-left">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t('hero.eyebrow')}
            </span>
            <h1 className="font-display text-headline-lg-mobile text-primary md:text-headline-lg xl:text-display-lg">
              {t('hero.titlePrefix')} <em>{t('hero.titleEmphasis')}</em>
            </h1>
            <p className="mt-2 max-w-measure text-body-md text-on-surface-variant md:text-body-lg">{t('hero.lead')}</p>
          </div>

          <div className="order-3 grid grid-cols-2 gap-3 md:flex md:justify-center md:gap-space-sm xl:justify-start">
            <a
              href={`tel:${shop.phone}`}
              className="flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 text-label-lg text-on-primary shadow-ambient transition-colors hover:bg-primary-hover md:min-w-40 md:gap-2 md:px-5"
            >
              <Phone className="h-4 w-4" aria-hidden />
              {t('cta.call')}
              <span className="hidden xl:inline">· {shop.phoneDisplay}</span>
            </a>
            <a
              href={shop.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-secondary-container px-3 text-label-lg text-on-secondary-container transition-colors hover:bg-primary-fixed md:min-w-40 md:gap-2 md:px-5"
            >
              <MapIcon className="h-4 w-4" aria-hidden />
              {t('cta.maps')}
            </a>
          </div>

          <div className="order-4 rounded-md bg-surface-container-lowest p-space-md shadow-ambient md:grid md:grid-cols-2 md:gap-space-lg md:p-space-lg xl:block">
            <div className="space-y-space-md">
              <div className="flex items-start gap-space-sm">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-label-sm uppercase text-outline">{t('info.addressLabel')}</p>
                  <p className="text-title-md text-on-surface">{ts('addressFull')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <CopyAddressButton address={ts('addressFull')} />
                    <span className="text-body-sm text-outline">{t('info.floor')}</span>
                  </div>
                </div>
              </div>
              <div className="h-px bg-surface-container-highest" />
              <div className="flex items-start gap-space-sm">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-on-secondary-fixed">
                  <Clock className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-label-sm uppercase text-outline">{t('info.hoursLabel')}</p>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between rounded-default bg-surface-container-low px-3 py-2">
                      <span className="flex items-center gap-1.5 text-label-lg text-on-surface">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {ts('weekdays')}
                      </span>
                      <span className="text-label-sm font-semibold text-primary">{ts('weekdaysHours')}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-default bg-surface-container-low px-3 py-2">
                      <span className="flex items-center gap-1.5 text-label-lg text-on-surface">
                        <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                        {ts('weekendLong')}
                      </span>
                      <span className="text-label-sm font-semibold text-tertiary">{ts('weekendHours')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="my-space-md h-px bg-surface-container-highest md:hidden xl:block" />

            <div className="flex items-start gap-space-sm md:border-l md:border-surface-container-highest md:pl-space-lg xl:border-0 xl:pl-0">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                <Share2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-label-sm uppercase text-outline">{t('info.socialLabel')}</p>
                <ul className="mt-2 grid gap-2 xl:grid-cols-2">
                  {shop.social.map(({ key, href }) => {
                    const Icon = socialIcons[key];
                    return (
                      <li key={key}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-12 items-center justify-between rounded-default bg-surface-container-low p-2.5 transition-colors hover:bg-secondary-fixed/40"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-primary">
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-label-lg text-on-surface">{ts(`social.${key}.name`)}</span>
                              <span className="block truncate text-body-sm text-outline">{ts(`social.${key}.detail`)}</span>
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-outline" aria-hidden />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* store photo: 4:5 mobile · 3:2 tablet · 4:5 sticky right column desktop */}
        <figure className="relative order-2 aspect-4/5 overflow-hidden rounded-md shadow-ambient md:aspect-3/2 xl:sticky xl:top-28 xl:order-none xl:col-span-6 xl:col-start-7 xl:row-start-1 xl:aspect-4/5 xl:self-start">
          <Image
            src="/images/store.png"
            alt={t('photo.alt')}
            fill
            sizes="(min-width: 1280px) 600px, 100vw"
            className="object-cover"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-inverse-surface/80 to-transparent p-space-md pt-space-xl text-inverse-on-surface md:p-space-lg">
            <p className="flex items-center gap-1.5 text-label-sm uppercase">
              <span className="h-2 w-2 rounded-full bg-secondary-container" />
              {t('photo.status')}
            </p>
            <p className="font-display text-headline-sm md:text-headline-md">{ts('addressShort')}</p>
            <p className="text-body-sm">{t('photo.caption')}</p>
          </figcaption>
        </figure>
      </section>

      <section
        aria-labelledby="perks"
        className="mx-auto mt-space-lg max-w-page px-margin-mobile md:mt-space-xl md:px-space-lg xl:px-margin"
      >
        <div className="rounded-md bg-surface-container-low p-space-md md:p-space-lg">
          <h2
            id="perks"
            className="mb-space-sm flex items-center gap-2 text-title-md text-on-surface md:mb-space-md md:font-display md:text-headline-sm"
          >
            <BadgeCheck className="h-5 w-5 text-primary" aria-hidden />
            {t('perks.title')}
          </h2>
          <ul className="grid gap-3 md:grid-cols-3 md:gap-gutter">
            {privileges.map(({ key, icon: Icon, tone }) => (
              <li key={key} className="flex items-start gap-3 rounded-default bg-surface-container-lowest p-3 md:flex-col md:p-space-md">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:h-10 md:w-10 ${tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-label-lg text-on-surface">{t(`perks.${key}.title`)}</p>
                  <p className="mt-0.5 text-body-sm text-on-surface-variant">{t(`perks.${key}.detail`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

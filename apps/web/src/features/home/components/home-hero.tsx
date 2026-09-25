import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

/**
 * mobile: full-bleed 4:5 + card overlaps · md: framed 16:9 + card bottom-left ·
 * xl: text cols 1–7 over the arched photo cols 7–12 (design/responsive.md §4 Home).
 */
export function HomeHero() {
  const t = useTranslations('home.hero');
  return (
    <section className="relative md:mx-auto md:max-w-page md:px-space-lg md:pt-space-lg xl:grid xl:grid-cols-12 xl:items-center xl:gap-x-gutter xl:px-margin xl:pt-space-xl">
      <div className="relative aspect-4/5 max-h-125 w-full overflow-hidden md:aspect-video md:max-h-none md:rounded-xl xl:col-span-6 xl:col-start-7 xl:row-start-1 xl:aspect-4/5 xl:rounded-t-full xl:rounded-b-md">
        <Image
          src="/images/hero.jpg"
          alt={t('imageAlt')}
          fill
          priority
          sizes="(min-width: 1280px) 600px, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/30 to-transparent md:from-surface/40 xl:hidden" />
      </div>
      <div className="relative z-10 -mt-24 px-margin-mobile md:-mt-40 md:w-3/4 md:px-0 md:pl-space-lg xl:col-span-7 xl:col-start-1 xl:row-start-1 xl:mt-0 xl:w-auto xl:pl-0">
        <div className="flex flex-col items-center rounded-md bg-surface-container-lowest/95 p-6 text-center shadow-ambient backdrop-blur md:items-start md:p-space-lg md:text-left xl:p-space-xl">
          <span className="mb-2 text-label-sm uppercase tracking-widest text-primary xl:text-label-lg">{t('eyebrow')}</span>
          <h1 className="mb-3 font-display text-headline-lg-mobile text-primary md:text-headline-lg xl:text-display-lg">
            {t('titleLine1')}
            <br />
            <em className="text-secondary">{t('titleLine2')}</em>
          </h1>
          <p className="mb-6 max-w-xs text-body-md text-on-surface-variant md:max-w-measure md:text-body-lg">{t('lead')}</p>
          <a
            href="#bo-suu-tap"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-label-lg text-on-primary transition-colors hover:bg-primary-hover md:w-auto md:min-w-40"
          >
            {t('cta')} <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

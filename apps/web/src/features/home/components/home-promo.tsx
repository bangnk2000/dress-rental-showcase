import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { shop } from '@/lib/shop';

/** mobile: stacked · md+: text left, Zalo pill right (owner 2026-09-25: promo → Zalo directly). */
export function HomePromo() {
  const t = useTranslations('home.promo');
  return (
    <section className="mx-auto mt-space-lg max-w-page px-margin-mobile md:mt-space-xl md:px-space-lg xl:px-margin">
      <div className="relative overflow-hidden rounded-md bg-linear-to-br from-primary via-primary-container to-secondary p-6 text-on-primary shadow-ambient md:flex md:items-center md:justify-between md:gap-space-lg md:p-space-lg xl:p-space-xl">
        <div className="absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-on-primary/10 blur-xl xl:h-72 xl:w-72" />
        <div className="relative md:max-w-measure">
          <span className="mb-3 inline-block rounded-full bg-on-primary/20 px-3 py-1 text-label-sm uppercase tracking-widest">
            {t('eyebrow')}
          </span>
          <h2 className="mb-2 font-display text-headline-sm md:text-headline-md">{t('title')}</h2>
          <p className="text-body-sm text-on-primary-container md:text-body-md">{t('body')}</p>
        </div>
        <a
          href={shop.zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container-lowest px-6 text-label-lg text-primary transition-colors hover:bg-primary-fixed md:mt-0 md:w-auto md:shrink-0"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('cta')}
        </a>
      </div>
    </section>
  );
}

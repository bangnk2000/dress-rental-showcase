import { MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { shop } from '@/lib/shop';

import { SiteNav } from './site-nav';

/** mobile: slim bar that scrolls away · md: sticky 72px + inline nav · xl: 80px + Zalo pill. */
export function SiteHeader() {
  const t = useTranslations('common');
  return (
    <header className="bg-surface/85 backdrop-blur-lg md:sticky md:top-0 md:z-40 md:shadow-ambient">
      <div className="relative mx-auto flex h-14 max-w-page items-center justify-between px-margin-mobile md:h-18 md:px-space-lg xl:h-20 xl:px-margin">
        <Link href="/" className="flex items-center gap-2.5" aria-label={t('site.homeLabel')}>
          <Image
            src="/images/logo.jpg"
            alt=""
            width={48}
            height={48}
            priority
            className="h-10 w-10 rounded-default object-cover xl:h-12 xl:w-12"
          />
          <span className="flex flex-col leading-none">
            <span className="font-display text-headline-sm lowercase text-primary">{t('site.name')}</span>
            <span className="text-label-sm uppercase text-secondary">{t('site.tagline')}</span>
          </span>
        </Link>
        <SiteNav />
        <a
          href={shop.zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden min-h-11 items-center gap-2 rounded-full border border-secondary-container px-5 text-label-lg text-primary transition-colors hover:bg-primary-fixed xl:inline-flex"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('nav.zalo')}
        </a>
      </div>
    </header>
  );
}

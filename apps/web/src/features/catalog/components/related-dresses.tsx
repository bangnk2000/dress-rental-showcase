import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { PublicDressSummary } from '@/api/mock/public-catalog';
import { Link } from '@/i18n/navigation';

import { relatedVisibility } from '../lib/filters';
import { DressCard } from './dress-card';

export function RelatedDresses({ dresses }: { dresses: PublicDressSummary[] }) {
  const t = useTranslations('catalog.related');
  if (dresses.length === 0) return null;
  return (
    <section
      aria-labelledby="related"
      className="mx-auto mt-space-lg max-w-page px-margin-mobile md:mt-space-xl md:px-space-lg xl:px-margin"
    >
      <div className="mb-space-md flex items-end justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase tracking-widest text-secondary xl:text-label-lg">{t('eyebrow')}</p>
          <h2 id="related" className="font-display text-headline-sm text-primary md:text-headline-md">
            {t('title')}
          </h2>
        </div>
        <Link
          href="/bo-suu-tap"
          className="hit relative flex shrink-0 items-center gap-0.5 text-label-sm text-primary underline decoration-tertiary-fixed underline-offset-4 xl:text-label-lg"
        >
          {t('viewAll')} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3.5 md:grid-cols-3 md:gap-gutter xl:grid-cols-4">
        {dresses.map((dress, i) => (
          <DressCard key={dress.slug} dress={dress} className={relatedVisibility(i)} />
        ))}
      </ul>
    </section>
  );
}

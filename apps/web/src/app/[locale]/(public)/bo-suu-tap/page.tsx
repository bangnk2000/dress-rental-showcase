import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { listPublicDresses } from '@/api/public-catalog';
import { BottomTabBar } from '@/components/site/bottom-tab-bar';
import { SiteFooter } from '@/components/site/site-footer';
import { CatalogBrowser } from '@/features/catalog';
import { resolveLocale } from '@/i18n/locale';

// FR-WEB-02 — ISR over GET /public/dresses (docs/design/web/public-pages.md §2).
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]/bo-suu-tap'>): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'catalog' });
  return { title: t('meta.title'), description: t('meta.description'), alternates: { canonical: '/bo-suu-tap' } };
}

export default async function CollectionPage({ params }: PageProps<'/[locale]/bo-suu-tap'>) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, dresses] = await Promise.all([
    getTranslations({ locale, namespace: 'catalog.page' }),
    listPublicDresses(),
  ]);

  return (
    <>
      <main className="mx-auto max-w-page px-margin-mobile pb-24 pt-space-md md:px-space-lg md:pb-0 md:pt-space-xl xl:px-margin">
        <header className="mb-space-md md:mb-space-lg">
          <p className="text-label-sm uppercase tracking-widest text-secondary xl:text-label-lg">{t('eyebrow')}</p>
          <h1 className="font-display text-headline-lg-mobile text-primary md:text-headline-lg xl:text-display-lg">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-measure text-body-md text-on-surface-variant md:text-body-lg">{t('lead')}</p>
        </header>
        <CatalogBrowser dresses={dresses} />
      </main>
      <SiteFooter />
      <BottomTabBar />
    </>
  );
}

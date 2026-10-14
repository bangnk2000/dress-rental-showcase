import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { listPublicDresses } from '@/api/public-catalog';
import { BottomTabBar } from '@/components/site/bottom-tab-bar';
import { SiteFooter } from '@/components/site/site-footer';
import { FeaturedCollection } from '@/features/catalog';
import { HomeHero, HomePerks, HomePromo, StoreInfo } from '@/features/home';
import { resolveLocale } from '@/i18n/locale';
import { pageOpenGraph } from '@/lib/seo';

// FR-WEB-01 — ISR: rendered once, re-read from GET /public/dresses at most every 5 min
// (docs/design/web/public-pages.md §2). A literal, not CATALOG_REVALIDATE: Next reads it statically.
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const [t, common] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'common' }),
  ]);
  const siteName = common('site.name');
  return {
    title: t('meta.title'),
    alternates: { canonical: '/' },
    ...pageOpenGraph({ siteName, title: `${t('meta.title')} · ${siteName}`, description: common('site.description'), path: '/' }),
  };
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  setRequestLocale(resolveLocale((await params).locale));
  // 8 cards: rendered 4 / 6 / 8 at mobile / md / xl (design/responsive.md §4).
  const dresses = await listPublicDresses({ limit: 8 });

  return (
    <>
      <main className="pb-24 md:pb-0">
        <HomeHero />
        <StoreInfo />
        <FeaturedCollection dresses={dresses} />
        <HomePerks />
        <HomePromo />
      </main>
      <SiteFooter />
      <BottomTabBar />
    </>
  );
}

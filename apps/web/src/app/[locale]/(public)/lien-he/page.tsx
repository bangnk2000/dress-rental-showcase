import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { BottomTabBar } from '@/components/site/bottom-tab-bar';
import { SiteFooter } from '@/components/site/site-footer';
import { ContactPage } from '@/features/contact';
import { resolveLocale } from '@/i18n/locale';
import { pageOpenGraph } from '@/lib/seo';

// FR-WEB-04 — ● SSG, no data.
export async function generateMetadata({ params }: PageProps<'/[locale]/lien-he'>): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const [t, common] = await Promise.all([
    getTranslations({ locale, namespace: 'contact' }),
    getTranslations({ locale, namespace: 'common' }),
  ]);
  const siteName = common('site.name');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/lien-he' },
    ...pageOpenGraph({ siteName, title: `${t('meta.title')} · ${siteName}`, description: t('meta.description'), path: '/lien-he' }),
  };
}

export default async function ContactRoute({ params }: PageProps<'/[locale]/lien-he'>) {
  setRequestLocale(resolveLocale((await params).locale));
  return (
    <>
      <main className="pb-24 md:pb-space-xl">
        <ContactPage />
      </main>
      {/* below xl the page itself is the contact info */}
      <SiteFooter desktopOnly />
      <BottomTabBar />
    </>
  );
}

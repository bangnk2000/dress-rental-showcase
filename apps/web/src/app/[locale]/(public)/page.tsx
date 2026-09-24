import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { resolveLocale } from '@/i18n/locale';

// Placeholder home — static (● SSG in the build route table). The first public capability
// replaces this body with a feature slice; the page stays a thin Server Component.
export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'common' });
  return { title: t('home.title'), alternates: { canonical: '/' } };
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  setRequestLocale(resolveLocale((await params).locale));
  const t = await getTranslations('common');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-space-md px-margin-mobile text-center md:px-margin">
      <p className="text-label-sm uppercase text-tertiary">{t('site.name')}</p>
      <h1 className="font-display text-display-lg-mobile text-on-surface md:text-display-lg">{t('home.title')}</h1>
      <p className="text-on-surface-variant">{t('home.description')}</p>
    </main>
  );
}

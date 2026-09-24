import type { Metadata } from 'next';
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { resolveLocale } from '@/i18n/locale';
import { routing } from '@/i18n/routing';

import { Providers } from '../providers';
import '../globals.css';

// DESIGN.md §Typography. Self-hosted at build time; `vietnamese` keeps diacritics in-font.
const playfairDisplay = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  style: ['normal', 'italic'],
  variable: '--font-playfair-display',
  display: 'swap',
});
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3001'),
    title: { default: t('site.name'), template: `%s · ${t('site.name')}` },
    description: t('site.tagline'),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${playfairDisplay.variable} ${plusJakartaSans.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

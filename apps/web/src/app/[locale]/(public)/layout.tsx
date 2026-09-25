import { setRequestLocale } from 'next-intl/server';

import { SiteHeader } from '@/components/site/site-header';
import { resolveLocale } from '@/i18n/locale';

// Shared header only. The bottom of the page differs per page (tab bar vs the product's sticky
// action bar; Contact shows the footer on xl only), so each page composes its own.
// setRequestLocale here too: layouts render in parallel with pages, and a translated header
// without it makes next-intl read headers() — every route would turn ƒ dynamic.
export default async function PublicLayout({ children, params }: LayoutProps<'/[locale]'>) {
  setRequestLocale(resolveLocale((await params).locale));
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}

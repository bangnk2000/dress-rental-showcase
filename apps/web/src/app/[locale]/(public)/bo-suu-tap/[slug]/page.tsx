import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getPublicDress, listPublicDresses } from '@/api/public-catalog';
import { DressActionBar, DressDetail, RelatedDresses, relatedDresses } from '@/features/catalog';
import { resolveLocale } from '@/i18n/locale';

// FR-WEB-03 — ISR over GET /public/dresses/:slug (docs/design/web/public-pages.md §2). Slugs
// published at build time are prerendered; one published later renders on its first request and
// is cached from then on. Unpublished / unknown → the localized 404.
export const revalidate = 300;

export async function generateStaticParams() {
  return (await listPublicDresses()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/bo-suu-tap/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const dress = await getPublicDress(slug);
  if (!dress) return {};
  return {
    title: dress.name,
    description: dress.description,
    alternates: { canonical: `/bo-suu-tap/${dress.slug}` },
    openGraph: { title: dress.name, description: dress.description, images: [{ url: dress.cover.src, alt: dress.cover.alt }] },
  };
}

export default async function DressPage({ params }: PageProps<'/[locale]/bo-suu-tap/[slug]'>) {
  const { locale, slug } = await params;
  setRequestLocale(resolveLocale(locale));
  // Related comes from the (already cached) list — no endpoint of its own.
  const [dress, all] = await Promise.all([getPublicDress(slug), listPublicDresses()]);
  if (!dress) notFound();

  return (
    <>
      {/* mobile: the sticky action bar replaces the tab bar → reserve its height */}
      <main className="pb-28 md:pb-space-xl">
        <DressDetail dress={dress} />
        <RelatedDresses dresses={relatedDresses(all, dress)} />
      </main>
      <DressActionBar dress={dress} />
    </>
  );
}

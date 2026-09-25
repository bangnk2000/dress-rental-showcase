import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { getPublicDress, listPublicDresses, listRelatedDresses } from '@/api/mock/public-catalog';
import { DressActionBar, DressDetail, RelatedDresses } from '@/features/catalog';
import { resolveLocale } from '@/i18n/locale';

// FR-WEB-03 — ● SSG, one page per mock dress; any other slug is the localized 404.
export const dynamicParams = false;

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
  const [dress, related] = await Promise.all([getPublicDress(slug), listRelatedDresses(slug)]);
  if (!dress) notFound();

  return (
    <>
      {/* mobile: the sticky action bar replaces the tab bar → reserve its height */}
      <main className="pb-28 md:pb-space-xl">
        <DressDetail dress={dress} />
        <RelatedDresses dresses={related} />
      </main>
      <DressActionBar dress={dress} />
    </>
  );
}

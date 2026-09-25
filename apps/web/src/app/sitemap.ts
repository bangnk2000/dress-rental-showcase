import type { MetadataRoute } from 'next';

import { listPublicDresses } from '@/api/mock/public-catalog';

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3001';

// One entry per PUBLIC page; a feature that adds an indexable segment adds its line here.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dresses = await listPublicDresses();
  return [
    { url: `${siteUrl}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/bo-suu-tap`, changeFrequency: 'weekly', priority: 0.9 },
    ...dresses.map((d) => ({ url: `${siteUrl}/bo-suu-tap/${d.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    { url: `${siteUrl}/lien-he`, changeFrequency: 'monthly', priority: 0.7 },
  ];
}

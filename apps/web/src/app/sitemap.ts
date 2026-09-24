import type { MetadataRoute } from 'next';

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3001';

// One entry per PUBLIC page; a feature that adds an indexable segment adds its line here.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl}/`, changeFrequency: 'weekly', priority: 1 }];
}

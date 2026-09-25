import { cache } from 'react';

import { mockDresses } from './public-catalog.data';
import type { PublicDressDetail, PublicDressSummary } from './public-catalog.types';

export type * from './public-catalog.types';

// MOCK public catalogue API (docs/design/web/public-pages.md). The BE has no anonymous endpoint
// yet; these functions keep the signatures a generated client will have — async, DTO-returning —
// so swapping to `pnpm contract` output later touches only this file. `cache` dedupes the calls
// generateMetadata and the page make during one render.

const toSummary = ({ slug, name, tagline, occasion, occasionLabel, badge, rentalPricePerDay, retailPrice, cover }: PublicDressDetail): PublicDressSummary => ({
  slug,
  name,
  tagline,
  occasion,
  occasionLabel,
  badge,
  rentalPricePerDay,
  retailPrice,
  cover,
});

export const listPublicDresses = cache(async (params: { limit?: number } = {}): Promise<PublicDressSummary[]> => {
  const all = mockDresses.map(toSummary);
  return params.limit === undefined ? all : all.slice(0, params.limit);
});

export const getPublicDress = cache(async (slug: string): Promise<PublicDressDetail | null> => {
  return mockDresses.find((d) => d.slug === slug) ?? null;
});

/** Same occasion first, then the rest of the catalogue — never the dress itself. */
export const listRelatedDresses = cache(async (slug: string, limit = 4): Promise<PublicDressSummary[]> => {
  const self = mockDresses.find((d) => d.slug === slug);
  const others = mockDresses.filter((d) => d.slug !== slug);
  const ranked = self ? [...others.filter((d) => d.occasion === self.occasion), ...others.filter((d) => d.occasion !== self.occasion)] : others;
  return ranked.slice(0, limit).map(toSummary);
});

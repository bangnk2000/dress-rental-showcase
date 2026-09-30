import 'server-only';

import { cache } from 'react';

import { getPublicDressHttpControllerGet, listPublicDressesHttpControllerList } from './generated/catalog/catalog';
import type {
  PublicDressDetailDto,
  PublicDressSpecsDto,
  PublicDressSummaryDto,
  PublicDressSummaryDtoBadge,
  PublicDressSummaryDtoStylesItem,
  PublicImageDto,
} from './generated/model';
import { HttpError } from './mutator/custom-fetch';

// The public catalogue as the site's RSC pages read it (docs/design/catalog/public-listing.md §4,
// docs/design/web/public-pages.md §2): anonymous `GET /public/dresses[/:slug]` through the
// generated client, cached in the Next Data Cache and refreshed every 5 minutes (ISR). A failed
// revalidation keeps serving the last good page. Features take these DTOs as props and import only
// the types below.

export type PublicDressSummary = PublicDressSummaryDto;
export type PublicDressDetail = PublicDressDetailDto;
export type PublicDressSpecs = PublicDressSpecsDto;
export type PublicImage = PublicImageDto;
export type PublicStyle = PublicDressSummaryDtoStylesItem;
export type PublicDressBadge = PublicDressSummaryDtoBadge;

/** Seconds a cached catalogue response stays fresh — pages export the same literal as `revalidate`. */
export const CATALOG_REVALIDATE = 300;
export const CATALOG_TAG = 'public-dresses';

const cached = { cache: 'force-cache', next: { revalidate: CATALOG_REVALIDATE, tags: [CATALOG_TAG] } } satisfies RequestInit;

const isBuild = () => process.env.NEXT_PHASE === 'phase-production-build';

/**
 * `next build` runs without a BE in CI: an UNREACHABLE BE at build time prerenders an empty
 * catalogue (the first revalidation fills it) instead of failing the build. An HTTP error from a
 * reachable BE, or any failure at runtime, still throws.
 */
async function orEmptyAtBuild<T>(load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (err) {
    if (!isBuild() || err instanceof HttpError) throw err;
    console.warn(`[public-catalog] BE unreachable at build — prerendering an empty catalogue (${String(err)})`);
    return [];
  }
}

/** Published listings, hot first then newest. `cache` dedupes calls within one render. */
export const listPublicDresses = cache(
  (params: { limit?: number } = {}): Promise<PublicDressSummary[]> =>
    orEmptyAtBuild(() => listPublicDressesHttpControllerList(params.limit === undefined ? undefined : params, cached)),
);

/** One listing by slug; `null` when unpublished / unknown (the page turns it into the 404). */
export const getPublicDress = cache(async (slug: string): Promise<PublicDressDetail | null> => {
  try {
    return await getPublicDressHttpControllerGet(encodeURIComponent(slug), cached);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
});

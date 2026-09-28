/** The badge the web shows on a listing (spec §1 Badge, §6.C). Computed at read time, never stored. */
export const LISTING_BADGES = ['available', 'new', 'hot'] as const;
export type ListingBadge = (typeof LISTING_BADGES)[number];

/** "new" lasts 30 days from the FIRST publication — unpublishing and republishing does not renew it. */
export const NEW_BADGE_DAYS = 30;
const NEW_BADGE_MS = NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;

/** hot (switched on by hand) > new (first published ≤ 30 days ago) > available. */
export function listingBadge(
  listing: { isHot: boolean; firstPublishedAt: Date | null },
  now: Date,
): ListingBadge {
  if (listing.isHot) return 'hot';
  if (
    listing.firstPublishedAt !== null &&
    now.getTime() - listing.firstPublishedAt.getTime() <= NEW_BADGE_MS
  ) {
    return 'new';
  }
  return 'available';
}

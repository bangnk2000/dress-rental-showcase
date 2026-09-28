import { z } from 'zod';
import { toDate } from '../../../libs/utils/date';
import { listingBadge } from '../domain/listing-badge';
import { Occasion } from '../domain/occasion.value-object';
import { PublicDressSummaryDto, PublicImageDto } from '../dtos/public-dress.response.dto';

/** What a dress WITHOUT a size is called on the web (spec §6.H). */
export const FREESIZE_LABEL = 'Freesize';
const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const timestamp = z.union([z.number(), z.string(), z.date()]);

/**
 * The ONLY listing columns a public query selects (R6 — explicit whitelist, never `SELECT *`),
 * plus the aggregate rental price computed over ACTIVE dresses.
 */
export const publicSummaryRowSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  occasions: z.array(z.string()),
  is_hot: z.boolean(),
  first_published_at: timestamp.nullable(),
  retail_price: z.number().int().nullable(),
  photo_urls: z.array(z.string()),
  rental_price: z.number().int(),
});

export type PublicSummaryRow = z.infer<typeof publicSummaryRowSchema>;

/** `"<name>"` for the cover, `"<name> — ảnh <n>"` (n = 1-based position) for the later photos. */
export function publicImages(name: string, photoUrls: readonly string[]): PublicImageDto[] {
  return photoUrls.map((src, index) =>
    Object.assign(new PublicImageDto(), {
      src,
      alt: index === 0 ? name : `${name} — ảnh ${index + 1}`,
    }),
  );
}

export function toPublicSummary(
  row: PublicSummaryRow,
  now: Date,
): PublicDressSummaryDto {
  const [cover] = publicImages(row.name, row.photo_urls.slice(0, 1));
  return Object.assign(new PublicDressSummaryDto(), {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    occasions: row.occasions as Occasion[],
    badge: listingBadge(
      {
        isHot: row.is_hot,
        firstPublishedAt: row.first_published_at === null ? null : toDate(row.first_published_at),
      },
      now,
    ),
    rentalPrice: row.rental_price,
    retailPrice: row.retail_price,
    // A published listing always has ≥ 1 photo (CHECK constraint, R3).
    cover,
  });
}

/** XS, S, M, L, XL first; then any other label A→Z; "Freesize" last (spec §Contract). */
export function compareSizeLabels(a: string, b: string): number {
  const rank = (label: string): number => {
    if (label === FREESIZE_LABEL) return STANDARD_SIZES.length + 1;
    const standard = STANDARD_SIZES.indexOf(label);
    return standard === -1 ? STANDARD_SIZES.length : standard;
  };
  const byRank = rank(a) - rank(b);
  if (byRank !== 0) return byRank;
  return a.localeCompare(b, 'vi');
}

import { DomainPrimitive, ValueObject } from '../../../libs/ddd/value-object.base';
import { ArgumentInvalidException } from '../../../libs/exceptions';

/** Same pattern as the `dress_listings.slug` CHECK constraint (R1). */
export const LISTING_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const LISTING_SLUG_MAX_LENGTH = 80;

/**
 * Turns a Vietnamese name into a slug: diacritics stripped (NFD + combining marks removed),
 * đ/Đ → d (it is a separate letter, NOT a combining mark, so NFD leaves it alone), lowercased,
 * every run of other characters collapsed to one '-', trimmed, cut to 80 chars on a word edge.
 * "Đầm dạ hội Ánh Trăng" → "dam-da-hoi-anh-trang". May return '' for a name with no letters.
 */
export function slugify(input: string): string {
  const ascii = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
  const joined = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (joined.length <= LISTING_SLUG_MAX_LENGTH) return joined;
  return joined.slice(0, LISTING_SLUG_MAX_LENGTH).replace(/-+$/g, '');
}

/**
 * The public URL key of a listing (`/bo-suu-tap/<slug>`), R1: `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 80.
 * Invalid input is INPUT invalid → thrown → 400 envelope (never an outcome).
 */
export class ListingSlug extends ValueObject<string> {
  protected validate({ value }: DomainPrimitive<string>): void {
    if (value.length > LISTING_SLUG_MAX_LENGTH || !LISTING_SLUG_PATTERN.test(value)) {
      throw new ArgumentInvalidException(
        `Slug must be ≤ ${LISTING_SLUG_MAX_LENGTH} chars of a-z, 0-9 joined by single dashes`,
      );
    }
  }

  static create(value: string): ListingSlug {
    return new ListingSlug({ value: value.trim() });
  }

  /** The slug the BE generates when the caller leaves it empty (spec §2 business input). */
  static fromName(name: string): ListingSlug {
    const slug = slugify(name);
    if (!slug) {
      throw new ArgumentInvalidException(
        'Cannot derive a slug from this name — send one explicitly',
      );
    }
    return new ListingSlug({ value: slug });
  }
}

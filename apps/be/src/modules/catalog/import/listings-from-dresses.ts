/**
 * Planner for the bulk "one draft listing per dress code group" tool
 * (`pnpm --filter be listings:from-dresses`). Pure: the script reads the rows, this decides what
 * to create, the script dispatches CreateListing + SetListingDresses per plan.
 *
 * A group is a base code plus its FR-CAT-08 copies (`VAY02`, `VAY02_1`, `VAY02_2` = three sizes of
 * one listing). Owner decisions (2026-09-30): drafts only, never published by the tool; styles
 * come from keywords in the dress name, and a name matching none gets `silk` (staff re-tag in
 * /website).
 */
import { DressCode } from '../domain/dress-code.value-object';
import { LISTING_MAX_PHOTOS } from '../domain/dress-listing.entity';
import { slugify } from '../domain/listing-slug.value-object';
import { STYLES, Style } from '../domain/style.value-object';

export interface SourceDress {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'retired';
  photoUrls: string[];
  /** Listing names this dress already belongs to (empty = unlisted). */
  listingNames: string[];
}

export interface ListingPlan {
  baseCode: string;
  /** Every code in the group, base first. */
  codes: string[];
  name: string;
  slug: string;
  styles: Style[];
  /** True when no keyword matched and the `silk` fallback was used. */
  stylesDefaulted: boolean;
  photoUrls: string[];
  dressIds: string[];
}

export interface SkippedGroup {
  baseCode: string;
  codes: string[];
  reason: string;
}

export interface ListingsFromDressesPlan {
  plans: ListingPlan[];
  skipped: SkippedGroup[];
}

export const FALLBACK_STYLE: Style = 'silk';

/** Keyword → style, matched on the lowercased NFC name. A name may hit several styles. */
const STYLE_KEYWORDS: Record<Style, RegExp> = {
  short: /ngắn/,
  silk: /lụa/,
  'ao-dai': /áo dài/,
  'off-shoulder': /(trễ|lệch) vai/,
  sleeved: /có tay|choàng/,
  'strappy-strapless': /(2|hai) ?dây|cúp ngực|yếm/,
  accessory: /phụ kiện/,
};

export function inferStyles(name: string): { styles: Style[]; defaulted: boolean } {
  const text = name.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
  const styles = STYLES.filter((style) => STYLE_KEYWORDS[style].test(text));
  return styles.length > 0
    ? { styles, defaulted: false }
    : { styles: [FALLBACK_STYLE], defaulted: true };
}

/** "váy có tay  ren" → "Váy có tay ren". */
export function listingNameOf(dressName: string): string {
  const name = dressName.normalize('NFC').trim().replace(/\s+/g, ' ');
  return name.charAt(0).toLocaleUpperCase('vi') + name.slice(1);
}

/** `VAY02` < `VAY02_1` < `VAY02_2` < `VAY02_10`. */
function copyNumber(code: string): number {
  const match = /_(\d+)$/.exec(code);
  return match ? Number(match[1]) : -1;
}

/**
 * `takenSlugs` = every slug already in `dress_listings`; the planner adds its own so two groups
 * with the same name never collide. Name slug first; taken → name + base code; still taken → skip.
 */
export function planListingsFromDresses(
  dresses: readonly SourceDress[],
  takenSlugs: ReadonlySet<string>,
): ListingsFromDressesPlan {
  const groups = new Map<string, SourceDress[]>();
  for (const dress of dresses) {
    const base = DressCode.baseOf(dress.code);
    groups.set(base, [...(groups.get(base) ?? []), dress]);
  }

  const taken = new Set(takenSlugs);
  const plans: ListingPlan[] = [];
  const skipped: SkippedGroup[] = [];

  const sortedGroups = [...groups].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  for (const [baseCode, group] of sortedGroups) {
    const members = [...group].sort((a, b) => copyNumber(a.code) - copyNumber(b.code));
    const [first] = members;
    if (!first) continue; // a group exists only because a dress landed in it
    const codes = members.map((dress) => dress.code);

    const listed = members.filter((dress) => dress.listingNames.length > 0);
    if (listed.length > 0) {
      const names = [...new Set(listed.flatMap((dress) => dress.listingNames))];
      skipped.push({ baseCode, codes, reason: `đã thuộc mẫu: ${names.join(', ')}` });
      continue;
    }
    if (!members.some((dress) => dress.status === 'active')) {
      skipped.push({ baseCode, codes, reason: 'không còn váy active' });
      continue;
    }

    const name = listingNameOf(first.name);
    const slug = [slugify(name), slugify(`${name} ${baseCode}`), slugify(baseCode)].find(
      (candidate) => candidate !== '' && !taken.has(candidate),
    );
    if (!slug) {
      skipped.push({ baseCode, codes, reason: `slug "${slugify(name)}" đã có mẫu dùng` });
      continue;
    }
    taken.add(slug);

    const { styles, defaulted } = inferStyles(name);
    plans.push({
      baseCode,
      codes,
      name,
      slug,
      styles,
      stylesDefaulted: defaulted,
      photoUrls: [...new Set(members.flatMap((dress) => dress.photoUrls))].slice(
        0,
        LISTING_MAX_PHOTOS,
      ),
      dressIds: members.map((dress) => dress.id),
    });
  }
  return { plans, skipped };
}

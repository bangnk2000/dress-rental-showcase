import type { PublicDressSummary, PublicStyle } from '@/api/public-catalog';

// Chip → styles it covers: one chip per style, plus "all".
export const styleFilters = {
  all: null,
  short: ['short'],
  silk: ['silk'],
  'ao-dai': ['ao-dai'],
  'off-shoulder': ['off-shoulder'],
  sleeved: ['sleeved'],
  'strappy-strapless': ['strappy-strapless'],
  accessory: ['accessory'],
} as const satisfies Record<string, readonly PublicStyle[] | null>;

export type StyleFilter = keyof typeof styleFilters;
export const styleFilterKeys = Object.keys(styleFilters) as StyleFilter[];

export function filterDresses<T extends PublicDressSummary>(dresses: T[], filter: StyleFilter): T[] {
  const styles: readonly PublicStyle[] | null = styleFilters[filter];
  return styles === null ? dresses : dresses.filter((d) => d.styles.some((s) => styles.includes(s)));
}

/** Home shows 4 / 6 / 8 cards at mobile / md / xl — never a half-empty last row (responsive.md §4). */
export function featuredVisibility(index: number): string {
  if (index < 4) return 'flex';
  if (index < 6) return 'hidden md:flex';
  return 'hidden xl:flex';
}

/** Related: 2×2 mobile · 3×1 tablet (4th hidden) · 4×1 desktop. */
export function relatedVisibility(index: number): string {
  return index < 3 ? 'flex' : 'flex md:hidden xl:flex';
}

/** Search public copy only; each whitespace-separated term must match either field. */
export function searchDresses<T extends PublicDressSummary>(dresses: T[], query: string): T[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return dresses;
  return dresses.filter((dress) => {
    const fields = [normalize(dress.name), normalize(dress.tagline)];
    return terms.every((term) => fields.some((field) => field.includes(term)));
  });
}

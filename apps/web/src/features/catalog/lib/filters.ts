import type { PublicDressSummary, PublicOccasion } from '@/api/mock/public-catalog';

// Chip → occasions it covers. "Áo Dài Nàng Thơ" also shows the yearbook áo dài.
export const occasionFilters = {
  all: null,
  gala: ['gala'],
  birthday: ['birthday'],
  'ao-dai': ['ao-dai', 'yearbook'],
} as const satisfies Record<string, readonly PublicOccasion[] | null>;

export type OccasionFilter = keyof typeof occasionFilters;
export const occasionFilterKeys = Object.keys(occasionFilters) as OccasionFilter[];

export function filterDresses<T extends PublicDressSummary>(dresses: T[], filter: OccasionFilter): T[] {
  const occasions: readonly PublicOccasion[] | null = occasionFilters[filter];
  return occasions === null ? dresses : dresses.filter((d) => occasions.includes(d.occasion));
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

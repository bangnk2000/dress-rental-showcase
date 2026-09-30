import type { PublicDressSummary } from '@/api/public-catalog';

/**
 * "Có Thể Nàng Cũng Thích", computed from the already-cached list (docs/design/catalog/public-listing.md
 * §4 — no extra endpoint): dresses sharing a style first, then the rest in list order — never the
 * dress itself.
 */
export function relatedDresses(
  all: PublicDressSummary[],
  self: Pick<PublicDressSummary, 'slug' | 'styles'>,
  limit = 4,
): PublicDressSummary[] {
  const others = all.filter((d) => d.slug !== self.slug);
  const shares = (d: PublicDressSummary) => d.styles.some((s) => self.styles.includes(s));
  return [...others.filter(shares), ...others.filter((d) => !shares(d))].slice(0, limit);
}

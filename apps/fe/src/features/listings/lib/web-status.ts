export type ListingWebStatus = 'draft' | 'published' | 'hidden';

/**
 * Nháp = not published; Đã đăng = published AND visible (≥ 1 active dress); Ẩn (hết váy) =
 * published but every attached dress is retired, so the web does not show it (R5 — not an error,
 * nothing auto-unpublishes).
 */
export function listingWebStatus(
  publishedAt: string | null,
  visibleOnWeb: boolean,
): ListingWebStatus {
  if (publishedAt === null) return 'draft';
  return visibleOnWeb ? 'published' : 'hidden';
}

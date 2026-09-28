/**
 * Client mirror of the BE `slugify` (apps/be catalog/domain/listing-slug.value-object.ts) — the
 * slug field pre-fills with EXACTLY what the server would derive, so the link staff see is the link
 * the web gets. Diacritics stripped (NFD + combining marks removed), đ/Đ → d (a separate letter, not
 * a combining mark), lowercased, every run of other characters → one '-', trimmed, ≤ 80 chars cut
 * on a word edge. "Đầm dạ hội Ánh Trăng" → "dam-da-hoi-anh-trang".
 */
export const LISTING_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const LISTING_SLUG_MAX_LENGTH = 80;

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

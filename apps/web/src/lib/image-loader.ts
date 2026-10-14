import { imageUrl } from '@dress-rental/image-url';
import type { ImageLoaderProps } from 'next/image';

/**
 * THE `next/image` loader (next.config.ts `images.loaderFile`) — the site never runs Next's own
 * optimiser. Dress photos in R2 (under `NEXT_PUBLIC_IMAGE_BASE_URL`) become Cloudflare Images
 * variants at the width Next asks for; widths come only from the fixed `deviceSizes`/`imageSizes`
 * in next.config.ts, so the variant count stays bounded (docs/design/catalog/dress-photo-upload.md §3).
 *
 * The site's own `/images/*` become variants too when `NEXT_PUBLIC_STATIC_IMAGE_BASE_URL` names
 * the public origin (prod `https://example.com` — same Cloudflare zone, Transformations on). Unset
 * (dev, CI: no Cloudflare in front, no `/cdn-cgi`) → the file as-is, with a `?w=` marker only so
 * Next's "loader ignores width" dev check stays quiet. Legacy links to other hosts are always
 * served unchanged (Cloudflare can only transform its own zone).
 *
 * `NEXT_PUBLIC_*` is inlined at build, so the loader works in the browser too.
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  const url = imageUrl(src, { width, quality }, { base: process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? null });
  if (url !== src || !src.startsWith('/')) return url;

  const site = process.env.NEXT_PUBLIC_STATIC_IMAGE_BASE_URL?.trim().replace(/\/+$/, '');
  if (site) return imageUrl(`${site}${src}`, { width, quality }, { base: site });
  return `${src}${src.includes('?') ? '&' : '?'}w=${width}`;
}

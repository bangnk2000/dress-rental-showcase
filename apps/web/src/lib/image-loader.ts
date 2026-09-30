import { imageUrl } from '@dress-rental/image-url';
import type { ImageLoaderProps } from 'next/image';

/**
 * THE `next/image` loader (next.config.ts `images.loaderFile`) — the site never runs Next's own
 * optimiser. Dress photos in R2 (under `NEXT_PUBLIC_IMAGE_BASE_URL`) become Cloudflare Images
 * variants at the width Next asks for; widths come only from the fixed `deviceSizes`/`imageSizes`
 * in next.config.ts, so the variant count stays bounded (docs/design/catalog/dress-photo-upload.md §3).
 *
 * Anything else is served as-is: legacy links to other hosts (Cloudflare can only transform its own
 * zone) and the site's own `/images/*`. A same-origin path gets a `?w=` marker only so Next's
 * "loader ignores width" dev check stays quiet — the static file ignores it.
 *
 * `NEXT_PUBLIC_*` is inlined at build, so the loader works in the browser too.
 */
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  const url = imageUrl(src, { width, quality }, { base: process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? null });
  if (url !== src) return url;
  return src.startsWith('/') ? `${src}${src.includes('?') ? '&' : '?'}w=${width}` : src;
}

/**
 * Cloudflare Images (Transformations) variant URLs for photos stored in R2
 * (docs/design/catalog/dress-photo-upload.md §1 "Biến thể", §3).
 *
 * A photo uploaded through the CMS is stored as `<base>/<key>`; its variant is
 * `<base>/cdn-cgi/image/width=<w>,quality=<q>,format=auto,fit=scale-down/<key>`, generated and
 * cached at Cloudflare's edge. Anything NOT under `base` — a legacy link pasted from another
 * host — is returned unchanged: Cloudflare can only transform images on its own zone.
 *
 * Shared by apps/fe and apps/web (root AGENTS.md invariant #4: cross-app sharing only through
 * packages/*). Pure and dependency-free so either runtime (Vite, Next loader) can call it.
 */

export interface ImageUrlOptions {
  /** Target width in CSS pixels. Callers use a FIXED set of widths so the variant count stays bounded. */
  width: number;
  /** 1–100; defaults to 80. */
  quality?: number;
}

export interface ImageUrlConfig {
  /** Public origin of the image bucket, e.g. `https://img.example.com`. Unset → every src is returned as-is. */
  base?: string | null;
}

const DEFAULT_QUALITY = 80;

export function imageUrl(src: string, opts: ImageUrlOptions, config: ImageUrlConfig): string {
  const base = config.base?.trim().replace(/\/+$/, '');
  if (!base) return src;

  const prefix = `${base}/`;
  if (!src.startsWith(prefix)) return src;

  const key = src.slice(prefix.length);
  // An empty key, or a src that is already a variant, has nothing (more) to transform.
  if (key.length === 0 || key.startsWith('cdn-cgi/')) return src;

  const width = Math.round(opts.width);
  const quality = opts.quality ?? DEFAULT_QUALITY;
  return `${base}/cdn-cgi/image/width=${width},quality=${quality},format=auto,fit=scale-down/${key}`;
}

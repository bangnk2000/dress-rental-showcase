import { imageUrl } from '@dress-rental/image-url';

/**
 * The CMS's fixed variant widths (docs/design/catalog/dress-photo-upload.md §3): a fixed set keeps
 * the number of Cloudflare Images variants bounded.
 */
export const PHOTO_WIDTH = { thumbnail: 160, large: 640 } as const;

/**
 * A dress photo at a display width. R2 photos (under `VITE_IMAGE_BASE_URL`) become Cloudflare Images
 * variants; legacy links to other hosts come back unchanged.
 *
 * THE one reader of `VITE_IMAGE_BASE_URL` — read per call, not captured at module load, so tests can
 * `vi.stubEnv` it.
 */
export function photoUrl(src: string, width: number): string {
  return imageUrl(src, { width }, { base: import.meta.env.VITE_IMAGE_BASE_URL ?? null });
}

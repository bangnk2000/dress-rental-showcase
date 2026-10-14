import { imageUrl } from '@dress-rental/image-url';
import type { Metadata } from 'next';

/**
 * Open Graph for every page. Link previews (Threads, Facebook, Zalo) read `og:*`; with none, Meta's
 * crawler guesses an `<img>` on its own re-scrape only, so a share showed no thumbnail until someone
 * ran the Sharing Debugger. Next REPLACES a parent's `openGraph` instead of merging it, so each page
 * passes its full set through here rather than relying on the layout's.
 */
export const SITE_OG_IMAGE = { url: '/images/hero.jpg', width: 1376, height: 768 } as const;

/** Share-preview width: Meta recommends ≥1200 px; also one of next.config.ts `deviceSizes`. */
const OG_IMAGE_WIDTH = 1200;

type OgInput = {
  siteName: string;
  title: string;
  description: string;
  /** Path relative to `metadataBase`, same as the page's canonical. */
  path: string;
  image?: { url: string; alt: string };
};

export function pageOpenGraph({ siteName, title, description, path, image }: OgInput): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = image
    ? [{ url: shareImageUrl(image.url), alt: image.alt }]
    : [{ ...SITE_OG_IMAGE, alt: siteName }];
  return {
    openGraph: { type: 'website', locale: 'vi_VN', siteName, title, description, url: path, images },
    twitter: { card: 'summary_large_image', title, description, images: images.map(({ url }) => url) },
  };
}

/** Dress photos are R2 originals (often several MB) → the Cloudflare variant crawlers can fetch fast. */
function shareImageUrl(src: string): string {
  return imageUrl(src, { width: OG_IMAGE_WIDTH }, { base: process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? null });
}

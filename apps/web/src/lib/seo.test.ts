import { afterEach, describe, expect, test, vi } from 'vitest';

import { pageOpenGraph, SITE_OG_IMAGE } from './seo';

const base = { siteName: 'Atelier Demo', title: 'Bộ sưu tập · Atelier Demo', description: 'Váy cho thuê', path: '/bo-suu-tap' };

afterEach(() => vi.unstubAllEnvs());

describe('pageOpenGraph — every page carries a full og:* set (link previews on Threads/Facebook)', () => {
  test('without a page image → the site image with its size, so crawlers need not fetch it first', () => {
    const { openGraph, twitter } = pageOpenGraph(base);
    expect(openGraph).toMatchObject({
      type: 'website',
      locale: 'vi_VN',
      siteName: 'Atelier Demo',
      title: base.title,
      description: base.description,
      url: '/bo-suu-tap',
      images: [{ ...SITE_OG_IMAGE, alt: 'Atelier Demo' }],
    });
    expect(twitter).toMatchObject({ card: 'summary_large_image', images: [SITE_OG_IMAGE.url] });
  });

  test('an R2 dress photo → its 1200 px Cloudflare variant, not the multi-MB original', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_BASE_URL', 'https://img.example.com');
    const { openGraph } = pageOpenGraph({ ...base, image: { url: 'https://img.example.com/dresses/a.jpg', alt: 'Váy A' } });
    expect(openGraph?.images).toEqual([
      { url: 'https://img.example.com/cdn-cgi/image/width=1200,quality=80,format=auto,fit=scale-down/dresses/a.jpg', alt: 'Váy A' },
    ]);
  });

  test('a photo on another host passes through unchanged', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_BASE_URL', 'https://img.example.com');
    const { openGraph } = pageOpenGraph({ ...base, image: { url: 'https://example.com/a.jpg', alt: 'A' } });
    expect(openGraph?.images).toEqual([{ url: 'https://example.com/a.jpg', alt: 'A' }]);
  });
});

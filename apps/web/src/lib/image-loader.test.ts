import { afterEach, describe, expect, test, vi } from 'vitest';

import imageLoader from './image-loader';

afterEach(() => vi.unstubAllEnvs());

describe('next/image loader', () => {
  test('an R2 photo becomes a Cloudflare Images variant at the requested width', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_BASE_URL', 'https://img.example.com');
    expect(imageLoader({ src: 'https://img.example.com/dresses/a.jpg', width: 640, quality: 70 })).toBe(
      'https://img.example.com/cdn-cgi/image/width=640,quality=70,format=auto,fit=scale-down/dresses/a.jpg',
    );
  });

  test('a legacy link from another host is served unchanged', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_BASE_URL', 'https://img.example.com');
    expect(imageLoader({ src: 'https://example.com/x.jpg', width: 640 })).toBe('https://example.com/x.jpg');
  });

  test('the site’s own static images pass through with a width marker', () => {
    expect(imageLoader({ src: '/images/hero.jpg', width: 1200 })).toBe('/images/hero.jpg?w=1200');
  });
});

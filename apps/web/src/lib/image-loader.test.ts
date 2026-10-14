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

  test('without a static origin (dev, CI) the site’s own images pass through with a width marker', () => {
    expect(imageLoader({ src: '/images/hero.jpg', width: 1200 })).toBe('/images/hero.jpg?w=1200');
  });

  test('with a static origin (prod) the site’s own images become variants on that origin', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGE_BASE_URL', 'https://img.example.com');
    vi.stubEnv('NEXT_PUBLIC_STATIC_IMAGE_BASE_URL', 'https://example.com/');
    expect(imageLoader({ src: '/images/store.jpg', width: 320 })).toBe(
      'https://example.com/cdn-cgi/image/width=320,quality=80,format=auto,fit=scale-down/images/store.jpg',
    );
  });

  test('a static origin never rewrites photos on other hosts', () => {
    vi.stubEnv('NEXT_PUBLIC_STATIC_IMAGE_BASE_URL', 'https://example.com');
    expect(imageLoader({ src: 'https://example.com/x.jpg', width: 640 })).toBe('https://example.com/x.jpg');
  });
});

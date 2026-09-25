import { describe, expect, test } from 'vitest';

import { imageUrl } from './index';

const BASE = 'https://img.example.com';

describe('imageUrl', () => {
  test('an R2 photo becomes a Cloudflare Images variant with the default quality', () => {
    expect(imageUrl(`${BASE}/photos/2026/09/abc.jpg`, { width: 160 }, { base: BASE })).toBe(
      `${BASE}/cdn-cgi/image/width=160,quality=80,format=auto,fit=scale-down/photos/2026/09/abc.jpg`,
    );
  });

  test('quality is passed through when given', () => {
    expect(imageUrl(`${BASE}/a.webp`, { width: 640, quality: 60 }, { base: BASE })).toBe(
      `${BASE}/cdn-cgi/image/width=640,quality=60,format=auto,fit=scale-down/a.webp`,
    );
  });

  test('a trailing slash on base is ignored', () => {
    expect(imageUrl(`${BASE}/photos/x.png`, { width: 160 }, { base: `${BASE}/` })).toBe(
      `${BASE}/cdn-cgi/image/width=160,quality=80,format=auto,fit=scale-down/photos/x.png`,
    );
  });

  test('a key with a nested path keeps every segment', () => {
    const src = `${BASE}/photos/2026/09/nested/dir/uuid.webp`;
    expect(imageUrl(src, { width: 160 }, { base: BASE })).toBe(
      `${BASE}/cdn-cgi/image/width=160,quality=80,format=auto,fit=scale-down/photos/2026/09/nested/dir/uuid.webp`,
    );
  });

  test('a foreign (legacy) link is returned unchanged', () => {
    const src = 'https://example.com/photos/a.jpg';
    expect(imageUrl(src, { width: 160 }, { base: BASE })).toBe(src);
  });

  test('a host that merely starts with the same characters is foreign', () => {
    const src = 'https://img.example.com.evil.test/a.jpg';
    expect(imageUrl(src, { width: 160 }, { base: BASE })).toBe(src);
  });

  test('base unset, null or blank → src unchanged', () => {
    const src = `${BASE}/photos/a.jpg`;
    expect(imageUrl(src, { width: 160 }, {})).toBe(src);
    expect(imageUrl(src, { width: 160 }, { base: null })).toBe(src);
    expect(imageUrl(src, { width: 160 }, { base: '' })).toBe(src);
  });

  test('the bare base and an existing variant are not transformed again', () => {
    expect(imageUrl(`${BASE}/`, { width: 160 }, { base: BASE })).toBe(`${BASE}/`);
    const variant = `${BASE}/cdn-cgi/image/width=160,quality=80,format=auto,fit=scale-down/a.jpg`;
    expect(imageUrl(variant, { width: 640 }, { base: BASE })).toBe(variant);
  });
});

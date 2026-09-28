import { expect, test } from 'vitest';

import { slugify } from './slugify';

test('strips Vietnamese diacritics, maps đ to d and joins words with dashes (mirrors the BE)', () => {
  expect(slugify('Đầm dạ hội Ánh Trăng')).toBe('dam-da-hoi-anh-trang');
  expect(slugify('  Váy  Nơ Lưng — Mini!! ')).toBe('vay-no-lung-mini');
  expect(slugify('Áo dài lụa 2026')).toBe('ao-dai-lua-2026');
  expect(slugify('!!!')).toBe('');
});

test('cuts at 80 characters without leaving a trailing dash', () => {
  const slug = slugify(`${'a'.repeat(79)} bcd`);
  expect(slug.length).toBeLessThanOrEqual(80);
  expect(slug.endsWith('-')).toBe(false);
});

import { ArgumentInvalidException } from '../../../libs/exceptions';
import { ListingSlug, slugify } from './listing-slug.value-object';

describe('slugify (public-listing R1)', () => {
  it('strips Vietnamese diacritics and maps đ/Đ to d', () => {
    expect(slugify('Đầm dạ hội Ánh Trăng')).toBe('dam-da-hoi-anh-trang');
    expect(slugify('Áo dài đỏ thắm')).toBe('ao-dai-do-tham');
    expect(slugify('Váy Tiểu Thư Ướt Át')).toBe('vay-tieu-thu-uot-at');
    expect(slugify('ĐƯỜNG ĐÊM')).toBe('duong-dem');
  });

  it('collapses every run of other characters into one dash and trims the ends', () => {
    expect(slugify('  Gala -- Night!!  (2026) ')).toBe('gala-night-2026');
    expect(slugify('A&B/C_d')).toBe('a-b-c-d');
  });

  it('cuts at 80 chars without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(79)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toBe('a'.repeat(79));
  });

  it('returns an empty string for a name with no letters or digits', () => {
    expect(slugify('!!! —')).toBe('');
  });
});

describe('ListingSlug', () => {
  it('accepts the canonical format', () => {
    expect(ListingSlug.create('dam-da-hoi-2026').unpack()).toBe('dam-da-hoi-2026');
  });

  it.each(['Dam', 'dam--da', '-dam', 'dam-', 'đầm', 'dam da', ''])(
    'rejects %p (400 input invalid, not an outcome)',
    (bad) => {
      expect(() => ListingSlug.create(bad)).toThrow(ArgumentInvalidException);
    },
  );

  it('rejects more than 80 chars', () => {
    expect(() => ListingSlug.create('a'.repeat(81))).toThrow(ArgumentInvalidException);
    expect(ListingSlug.create('a'.repeat(80)).unpack()).toHaveLength(80);
  });

  it('derives from a name, and refuses a name that yields nothing', () => {
    expect(ListingSlug.fromName('Đầm Xoè Công Chúa').unpack()).toBe('dam-xoe-cong-chua');
    expect(() => ListingSlug.fromName('???')).toThrow(ArgumentInvalidException);
  });
});

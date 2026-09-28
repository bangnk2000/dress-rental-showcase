import { compareSizeLabels, publicImages } from './public-dress.projection';

describe('public dress projection', () => {
  it('orders sizes XS, S, M, L, XL, then free sizes A→Z, Freesize last', () => {
    const labels = ['Freesize', 'XL', 'Size 38', 'M', 'Bầu', 'XS', 'L', 'S', 'Size 36'];
    expect([...labels].sort(compareSizeLabels)).toEqual([
      'XS',
      'S',
      'M',
      'L',
      'XL',
      'Bầu',
      'Size 36',
      'Size 38',
      'Freesize',
    ]);
  });

  it('alt is the name for the cover and "<name> — ảnh <n>" after it', () => {
    expect(publicImages('Đầm Ánh Trăng', ['https://a/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg'])).toEqual([
      { src: 'https://a/1.jpg', alt: 'Đầm Ánh Trăng' },
      { src: 'https://a/2.jpg', alt: 'Đầm Ánh Trăng — ảnh 2' },
      { src: 'https://a/3.jpg', alt: 'Đầm Ánh Trăng — ảnh 3' },
    ]);
  });
});

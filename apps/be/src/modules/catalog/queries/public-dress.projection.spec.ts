import { compareSizeLabels, publicBaseCodes, publicImages } from './public-dress.projection';

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

  it('codes are the distinct bases of the dress codes in natural order', () => {
    expect(publicBaseCodes(['VAY10', 'VAY1_2', 'VAY1', 'VAY1_1', 'VD-012_3', 'VAY2_10'])).toEqual([
      'VAY1',
      'VAY2',
      'VAY10',
      'VD-012',
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

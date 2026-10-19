import {
  SourceDress,
  inferStyles,
  listingNameOf,
  planListingsFromDresses,
} from './listings-from-dresses';

function dress(code: string, overrides: Partial<SourceDress> = {}): SourceDress {
  return {
    id: `id-${code}`,
    code,
    name: 'Váy trễ vai hồng',
    status: 'active',
    photoUrls: [],
    listingNames: [],
    ...overrides,
  };
}

describe('inferStyles', () => {
  it.each([
    ['váy có tay ren trắng châu hy', ['sleeved']],
    ['Váy 2 dây quai ngọc', ['strappy-strapless']],
    ['Váy ngắn cúp ngực đen', ['short', 'strappy-strapless']],
    ['Lụa lệch vai kèm dây dài', ['silk', 'off-shoulder']],
    ['Lụa be Tiin kèm choàng', ['silk', 'sleeved']],
    ['Áo dài trắng 2 tà', ['ao-dai']],
    ['Váy hai dây', ['strappy-strapless']],
    ['Phụ kiện cài tóc', ['accessory']],
  ])('%p → %p', (name, styles) => {
    expect(inferStyles(name)).toEqual({ styles, defaulted: false });
  });

  it('matches a decomposed (NFD) name too', () => {
    expect(inferStyles('Váy trễ vai'.normalize('NFD')).styles).toEqual(['off-shoulder']);
  });

  it('falls back to silk, flagged, when no keyword matches', () => {
    expect(inferStyles('Set váy kami')).toEqual({ styles: ['silk'], defaulted: true });
  });
});

describe('listingNameOf', () => {
  it('capitalizes the first letter and collapses spaces', () => {
    expect(listingNameOf('  váy có tay   ren ')).toBe('Váy có tay ren');
  });
});

describe('planListingsFromDresses', () => {
  it('makes ONE plan per base code, base first, copies in numeric order', () => {
    const { plans, skipped } = planListingsFromDresses(
      [
        dress('VAY02_10', { photoUrls: ['c'] }),
        dress('VAY02_1', { photoUrls: ['b', 'a'] }),
        dress('VAY02', { name: 'váy có tay khâu', photoUrls: ['a'] }),
        dress('VAY03', { name: 'Váy ngắn' }),
      ],
      new Set(),
    );
    expect(skipped).toEqual([]);
    expect(plans).toHaveLength(2);
    expect(plans[0]).toEqual({
      baseCode: 'VAY02',
      codes: ['VAY02', 'VAY02_1', 'VAY02_10'],
      name: 'Váy có tay khâu',
      slug: 'vay-co-tay-khau',
      styles: ['sleeved'],
      stylesDefaulted: false,
      photoUrls: ['a', 'b', 'c'],
      dressIds: ['id-VAY02', 'id-VAY02_1', 'id-VAY02_10'],
    });
    expect(plans[1]?.baseCode).toBe('VAY03');
  });

  it('sorts groups numerically (VAY9 before VAY10)', () => {
    const { plans } = planListingsFromDresses(
      [dress('VAY10', { name: 'Mười' }), dress('VAY9', { name: 'Chín' })],
      new Set(),
    );
    expect(plans.map((plan) => plan.baseCode)).toEqual(['VAY9', 'VAY10']);
  });

  it('skips a group when ANY of its dresses already belongs to a listing (re-run safe)', () => {
    const { plans, skipped } = planListingsFromDresses(
      [dress('VAY05'), dress('VAY05_1', { listingNames: ['Mẫu A'] })],
      new Set(),
    );
    expect(plans).toEqual([]);
    expect(skipped).toEqual([
      { baseCode: 'VAY05', codes: ['VAY05', 'VAY05_1'], reason: 'đã thuộc mẫu: Mẫu A' },
    ]);
  });

  it('skips a group whose dresses are all retired, keeps retired ones in a live group', () => {
    const { plans, skipped } = planListingsFromDresses(
      [
        dress('VAY06', { status: 'retired' }),
        dress('VAY07', { status: 'retired', name: 'Khác' }),
        dress('VAY07_1', { name: 'Khác' }),
      ],
      new Set(),
    );
    expect(skipped.map((group) => group.baseCode)).toEqual(['VAY06']);
    expect(plans[0]?.dressIds).toEqual(['id-VAY07', 'id-VAY07_1']);
  });

  it('adds the base code to a taken slug, also between groups of the same run', () => {
    const { plans } = planListingsFromDresses(
      [dress('VAY01'), dress('VAY02'), dress('VAY03')],
      new Set(['vay-tre-vai-hong-vay03']),
    );
    expect(plans.map((plan) => plan.slug)).toEqual([
      'vay-tre-vai-hong',
      'vay-tre-vai-hong-vay02',
      'vay03',
    ]);
  });

  it('caps photos at the listing limit', () => {
    const photoUrls = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const { plans } = planListingsFromDresses([dress('VAY01', { photoUrls })], new Set());
    expect(plans[0]?.photoUrls).toHaveLength(10);
  });
});

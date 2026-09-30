import type { PublicDressDetail, PublicDressSummary } from '@/api/public-catalog';

// Test fixture shaped like GET /public/dresses[/:slug] — the former mock catalogue (copy from the
// approved prototype, apps/web/design/prototype/build.mjs). The site reads the BE; only tests read this.
const shopImages = [
  { src: '/images/hero.jpg', alt: 'Đầm trưng bày tại Atelier Demo' },
  { src: '/images/store.png', alt: 'Không gian thử đồ tại 12 Phố Mẫu' },
];

const S = (available: string, all = ['XS', 'S', 'M', 'L']) =>
  all.map((label) => ({ label, available: available.split(',').includes(label) }));

const dresses: Omit<PublicDressDetail, 'images'>[] = [
  {
    slug: 'dam-da-hoi-long-lay',
    name: 'Đầm Dạ Hội Lộng Lẫy',
    tagline: 'Tùng xoè ren đính kết hạt cườm thủ công',
    description:
      'Tùng xoè ren đính kết hạt cườm thủ công, dáng corset tôn eo — dành cho những đêm gala và tiệc cưới nàng muốn là tâm điểm.',
    styles: ['strappy-strapless'],
    badge: 'available',
    rentalPrice: 350_000,
    retailPrice: 2_800_000,
    cover: { src: '/images/dresses/d1.jpg', alt: 'Đầm Dạ Hội Lộng Lẫy — toàn thân' },
    sizes: S('S,M'),
    specs: {
      material: 'Ren, tulle, hạt cườm đính tay',
      silhouette: 'Corset, chân váy xoè',
      length: 'Maxi chạm sàn',
      color: 'Hồng phấn',
      styles: 'Váy hai dây, cúp ngực',
    },
  },
  {
    slug: 'dam-tiec-tra-nang-tho',
    name: 'Đầm Tiệc Trà Nàng Thơ',
    tagline: 'Lụa tơ sống xếp nếp vai bồng dịu dàng',
    description: 'Lụa tơ sống xếp nếp, vai bồng nhẹ nhàng — hợp những buổi tiệc trà, picnic cuối tuần.',
    styles: ['off-shoulder'],
    badge: 'new',
    rentalPrice: 220_000,
    retailPrice: 1_600_000,
    cover: { src: '/images/dresses/d2.jpg', alt: 'Đầm Tiệc Trà Nàng Thơ' },
    sizes: S('XS,S,M,L'),
    specs: {
      material: 'Lụa tơ sống',
      silhouette: 'Vai bồng, thân xếp nếp',
      length: 'Midi',
      color: 'Kem',
      styles: 'Váy trễ vai',
    },
  },
  {
    slug: 'vay-sinh-nhat-prom',
    name: 'Váy Sinh Nhật / Prom',
    tagline: 'Dáng corset siết eo nơ lưng kiêu kỳ',
    description: 'Dáng corset siết eo, nơ lưng bản lớn kiêu kỳ — nổi bật trong đêm sinh nhật và prom.',
    styles: ['short'],
    badge: 'hot',
    rentalPrice: 180_000,
    retailPrice: 1_250_000,
    cover: { src: '/images/dresses/d3.jpg', alt: 'Váy Sinh Nhật / Prom' },
    sizes: S('S,M,L'),
    specs: {
      material: 'Satin, organza',
      silhouette: 'Corset, nơ lưng',
      length: 'Mini',
      color: 'Hồng đào',
      styles: 'Váy ngắn',
    },
  },
  {
    slug: 'ao-dai-cach-tan',
    name: 'Áo Dài Cách Tân',
    tagline: 'Tơ tằm cao cấp đính ngọc trai thanh lịch',
    description: 'Tơ tằm cao cấp đính ngọc trai, tà ngắn cách tân — thanh lịch cho dạo phố và lễ Tết.',
    styles: ['ao-dai'],
    badge: 'available',
    rentalPrice: 150_000,
    retailPrice: 950_000,
    cover: { src: '/images/dresses/d4.jpg', alt: 'Áo Dài Cách Tân' },
    sizes: S('XS,S,M'),
    specs: {
      material: 'Tơ tằm, ngọc trai',
      silhouette: 'Áo dài cách tân tà ngắn',
      length: 'Qua gối',
      color: 'Trắng ngà',
      styles: 'Áo dài',
    },
  },
  {
    slug: 'dam-lua-champagne',
    name: 'Đầm Lụa Champagne',
    tagline: 'Cổ vuông, tùng suông thanh lịch',
    description: 'Lụa champagne cổ vuông, tùng suông rủ mềm — thanh lịch cho khách mời đám cưới.',
    styles: ['silk'],
    badge: 'available',
    rentalPrice: 200_000,
    retailPrice: 1_400_000,
    cover: { src: '/images/dresses/d2.jpg', alt: 'Đầm Lụa Champagne' },
    sizes: S('S,M,L'),
    specs: {
      material: 'Lụa satin',
      silhouette: 'Cổ vuông, suông',
      length: 'Maxi',
      color: 'Champagne',
      styles: 'Váy lụa',
    },
  },
  {
    slug: 'dam-tulle-hong-phan',
    name: 'Đầm Tulle Hồng Phấn',
    tagline: 'Tầng tulle nhẹ bẫng, đính sequin',
    description: 'Nhiều tầng tulle nhẹ bẫng đính sequin lấp lánh — dành cho đêm gala.',
    styles: ['strappy-strapless'],
    badge: 'new',
    rentalPrice: 320_000,
    retailPrice: 2_400_000,
    cover: { src: '/images/dresses/d1.jpg', alt: 'Đầm Tulle Hồng Phấn' },
    sizes: S('XS,S'),
    specs: {
      material: 'Tulle, sequin',
      silhouette: 'Cúp ngực, xoè tầng',
      length: 'Maxi chạm sàn',
      color: 'Hồng phấn',
      styles: 'Váy hai dây, cúp ngực',
    },
  },
  {
    slug: 'ao-dai-lua-hoa-tiet',
    name: 'Áo Dài Lụa Hoạ Tiết',
    tagline: 'Lụa vẽ tay hoa nhí, tà dài',
    description: 'Lụa vẽ tay hoa nhí, tà dài truyền thống — nhẹ nhàng cho ngày chụp kỷ yếu.',
    styles: ['ao-dai'],
    badge: 'available',
    rentalPrice: 160_000,
    retailPrice: 1_100_000,
    cover: { src: '/images/dresses/d4.jpg', alt: 'Áo Dài Lụa Hoạ Tiết' },
    sizes: S('S,M,L'),
    specs: {
      material: 'Lụa vẽ tay',
      silhouette: 'Áo dài truyền thống',
      length: 'Tà dài',
      color: 'Trắng hoa nhí',
      styles: 'Áo dài',
    },
  },
  {
    slug: 'vay-no-lung-mini',
    name: 'Váy Nơ Lưng Mini',
    tagline: 'Corset nơ bản lớn, chân váy xoè',
    description: 'Corset nơ bản lớn sau lưng, chân váy xoè ngắn — trẻ trung cho tiệc sinh nhật.',
    styles: ['short'],
    badge: 'hot',
    rentalPrice: 190_000,
    retailPrice: 1_300_000,
    cover: { src: '/images/dresses/d3.jpg', alt: 'Váy Nơ Lưng Mini' },
    sizes: S('M,L'),
    specs: {
      material: 'Taffeta',
      silhouette: 'Corset, xoè',
      length: 'Mini',
      color: 'Hồng',
      styles: 'Váy ngắn',
    },
  },
];

export const fixtureDresses: PublicDressDetail[] = dresses.map((d) => ({ ...d, images: [d.cover, ...shopImages] }));

/** What the list endpoint returns for the same dresses (no detail-only fields). */
export const fixtureSummaries: PublicDressSummary[] = fixtureDresses.map(
  ({ slug, name, tagline, styles, badge, rentalPrice, retailPrice, cover }) => ({
    slug,
    name,
    tagline,
    styles,
    badge,
    rentalPrice,
    retailPrice,
    cover,
  }),
);

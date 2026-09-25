// Builds home.html / contact.html from *.src.html: fills image URLs (taken from the Stitch
// export — reference-only hot-links, never allowed in src/) and repeated markup.
// Run: node build.mjs   (from this folder)
import { readFileSync, writeFileSync } from 'node:fs';

const urls = (f) => [...readFileSync(`../stitch/${f}`, 'utf8').matchAll(/src="(https:\/\/lh3[^"]+)"/g)].map((m) => m[1]);
const [LOGO, HERO, D1, D2, D3, D4, STORE] = urls('home.html');

// Cards 5–6 appear from md (3×2), 7–8 from xl (4×2): no half-empty last row (§4).
const dresses = [
  [D1, 'Có sẵn', 'Gala & Red Carpet', 'Đầm Dạ Hội Lộng Lẫy', 'Tùng xoè ren đính kết hạt cườm thủ công', '350.000đ', '2.800k'],
  [D2, 'Mới về', 'Tea Party & Picnic', 'Đầm Tiệc Trà Nàng Thơ', 'Lụa tơ sống xếp nếp vai bồng dịu dàng', '220.000đ', '1.600k'],
  [D3, 'Hot Trend', 'Birthday & Prom', 'Váy Sinh Nhật / Prom', 'Dáng corset siết eo nơ lưng kiêu kỳ', '180.000đ', '1.250k'],
  [D4, 'Có sẵn', 'Dạo Phố & Lễ Tết', 'Áo Dài Cách Tân', 'Tơ tằm cao cấp đính ngọc trai thanh lịch', '150.000đ', '950k'],
  [D2, 'Có sẵn', 'Wedding Guest', 'Đầm Lụa Champagne', 'Cổ vuông, tùng suông thanh lịch', '200.000đ', '1.400k'],
  [D1, 'Mới về', 'Gala & Red Carpet', 'Đầm Tulle Hồng Phấn', 'Tầng tulle nhẹ bẫng, đính sequin', '320.000đ', '2.400k'],
  [D4, 'Có sẵn', 'Chụp Ảnh Kỷ Yếu', 'Áo Dài Lụa Hoạ Tiết', 'Lụa vẽ tay hoa nhí, tà dài', '160.000đ', '1.100k'],
  [D3, 'Hot Trend', 'Birthday & Prom', 'Váy Nơ Lưng Mini', 'Corset nơ bản lớn, chân váy xoè', '190.000đ', '1.300k'],
];
const visibility = (i) => (i < 4 ? 'flex' : i < 6 ? 'hidden md:flex' : 'hidden xl:flex');
// PDP "related": 2×2 mobile · 3×1 tablet (4th hidden) · 4×1 desktop
const relatedVisibility = (i) => (i < 3 ? 'flex' : 'flex md:hidden xl:flex');
const tagClass = (t) => (t === 'Hot Trend' ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface/90 text-primary backdrop-blur');

// The whole card is one link (stretched ::after on the name); the heart sits above it (z-10).
const card = (vis) => ([img, tag, cat, name, desc, price, retail], i) => `
    <li class="group relative ${vis(i)} flex-col overflow-hidden rounded-md bg-surface-container-lowest shadow-ambient">
      <div class="relative aspect-dress overflow-hidden bg-surface-container">
        <img src="${img}" alt="${name}" loading="lazy" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105">
        <span class="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-label-sm font-semibold ${tagClass(tag)}">${tag}</span>
        <button type="button" aria-label="Lưu ${name}" class="reveal hit absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-surface/80 text-primary backdrop-blur"><i data-lucide="heart" class="h-4 w-4"></i></button>
      </div>
      <div class="flex flex-1 flex-col justify-between p-3 md:p-space-md">
        <div>
          <p class="mb-0.5 text-label-sm uppercase text-outline">${cat}</p>
          <h3 class="line-clamp-1 text-body-md font-semibold"><a href="product.html" class="after:absolute after:inset-0 group-hover:text-primary">${name}</a></h3>
          <p class="mb-2 line-clamp-1 text-body-sm text-on-surface-variant">${desc}</p>
        </div>
        <div class="flex items-baseline justify-between border-t border-surface-container pt-2">
          <p class="whitespace-nowrap"><span class="text-label-lg tracking-normal text-primary">${price}</span><span class="text-label-sm tracking-normal text-outline"> /ngày</span></p>
          <span class="text-label-sm text-outline-variant line-through">${retail}</span>
        </div>
      </div>
    </li>`;
const cards = dresses.map(card(visibility)).join('');
const related = dresses.slice(1, 5).map(card(relatedVisibility)).join('');

const social = [
  ['facebook', 'Facebook', 'Thuê đồ Atelier Demo', 'https://facebook.com/atelierdemo'],
  ['instagram', 'Instagram', '@atelierdemo', 'https://instagram.com/atelierdemo'],
  ['music-2', 'TikTok', '@atelierdemo', 'https://tiktok.com/@atelierdemo'],
  ['message-circle', 'Zalo', '0901 000 000 · 24/7', 'https://zalo.me/0901000000'],
].map(([icon, name, sub, href]) => `
            <li><a href="${href}" target="_blank" rel="noopener noreferrer" class="flex min-h-12 items-center justify-between rounded bg-surface-container-low p-2.5 transition-colors hover:bg-secondary-fixed/40">
              <span class="flex min-w-0 items-center gap-2.5"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-primary"><i data-lucide="${icon}" class="h-4 w-4"></i></span>
              <span class="min-w-0"><span class="block text-label-lg">${name}</span><span class="block truncate text-body-sm text-outline">${sub}</span></span></span>
              <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-outline"></i></a></li>`).join('');

const fill = (src, map) => Object.entries(map).reduce((s, [k, v]) => s.replaceAll(`@@${k}@@`, v), readFileSync(src, 'utf8'));
writeFileSync('home.html', fill('home.src.html', { LOGO, HERO, STORE, CARDS: cards }));
writeFileSync('contact.html', fill('contact.src.html', { LOGO, STORE, SOCIAL: social }));
writeFileSync('product.html', fill('product.src.html', { LOGO, D1, HERO, RELATED: related }));
for (const f of ['home.html', 'contact.html', 'product.html']) {
  const left = readFileSync(f, 'utf8').match(/@@\w+@@/g);
  console.log(f, left ? `UNFILLED ${left}` : 'ok');
}

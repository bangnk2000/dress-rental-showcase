# web/public-pages — Trang chủ, Bộ sưu tập, Chi tiết váy, Liên hệ (mock data)

> Status: **as-built 2026-09-25 (mock data) · live BE data 2026-09-30 (§5)** · SRS: FR-WEB-01..04 · Tier: **design** (trang
> công khai/SEO mới — [init-nextjs 14 §1](../../spec/init-nextjs/14-design-first.md)) · Visual:
> [`apps/web/design/responsive.md`](../../../apps/web/design/responsive.md) + `prototype/` ·
> Ledger: `web:public-pages`

Chủ tiệm yêu cầu (2026-09-25) dựng các trang theo prototype **với dữ liệu mock trước**. BE chưa
có endpoint ẩn danh nào ([public-web.md](../public-web.md) §4) — nên dữ liệu váy đi qua một
**mock API** nằm trong ring `src/api/`, có hình dạng của DTO công khai tương lai (§4). Đổi sang
BE thật = thay phần thân của một file, không đụng feature nào.

## 1. Chia task

| # | Task | Output |
| --- | --- | --- |
| T1 | Kernel UI: token bổ sung (`max-w-page`, `max-w-measure`), utility `hit` (vùng chạm 44px), `scrollbar-none`, `pb-safe`, variant `can-hover`; `lucide-react`; asset local `public/images/` (tải từ Stitch, không hot-link) | `globals.css`, `public/images/*` |
| T2 | Shell dùng chung: `SiteHeader` (sticky md+, nav 3 mục, pill Zalo xl), `BottomTabBar` (mobile), `SiteFooter` (card → band 4 cột), `ShopOpenBadge`, thông tin tiệm `lib/shop.ts` | `src/components/site/*` |
| T3 | Mock API catalog: DTO `PublicDress*`, dữ liệu 8 váy, `listPublicDresses()`, `getPublicDress(slug)`, `listRelatedDresses(slug)` | `src/api/mock/public-catalog*.ts` |
| T4 | Feature `catalog`: `DressCard` (stretched link, tag, tim), `DressCollection` (chip lọc theo loại, 4/6/8 thẻ), `DressGallery` (carousel + counter + thumbnail), `DressDetail`, `DressActionBar` (mobile), `RelatedDresses` | `src/features/catalog/` |
| T5 | Feature `home`: Hero, StoreInfo, Perks, Promo | `src/features/home/` |
| T6 | Feature `contact`: tiêu đề, ảnh tiệm, CTA, thẻ thông tin (copy địa chỉ), social, đặc quyền | `src/features/contact/` |
| T7 | Route + SEO: `/`, `/bo-suu-tap`, `/bo-suu-tap/[slug]`, `/lien-he`; metadata, canonical, sitemap | `src/app/[locale]/(public)/**` |
| T8 | Test + gates: vitest (mock API, lọc chip, gallery, copy địa chỉ), check/lint/arch/test/build | ledger evidence |

## 2. Route + rendering (1a)

| Segment | Rendering | Cache owner | Ghi chú |
| --- | --- | --- | --- |
| `/` | ● SSG | mock (build time) | 8 váy nổi bật; chip lọc là client leaf |
| `/bo-suu-tap` | ● SSG | mock | toàn bộ váy + chip; đích của "Xem tất cả" và breadcrumb (prototype để `#`) |
| `/bo-suu-tap/[slug]` | ● SSG (`generateStaticParams`, `dynamicParams = false`) | mock | slug lạ → 404 tiếng Việt |
| `/lien-he` | ● SSG | không có data | |

Khi có BE: đổi thành ISR (`revalidate`) — quyết định cùng BE change request, không phải bây giờ.

## 3. Quyết định (agent mặc định — chủ tiệm chưa xác nhận)

1. **Tim "Lưu"** chỉ bật/tắt tại chỗ (không có session, không lưu) — giữ vì có trong thiết kế đã duyệt.
2. **"Đang mở cửa"** tính ở trình duyệt theo giờ Asia/Ho_Chi_Minh và giờ mở cửa trong `lib/shop.ts`
   (trang SSG không thể tính lúc build); trước khi hydrate không hiện badge.
3. **Lọc chip** lọc tại client trong danh sách đã tải; hàng cuối có thể lẻ khi đang lọc.
4. URL tiếng Việt không dấu: `/bo-suu-tap`, `/lien-he`.
5. Ảnh mock: 4 ảnh váy + logo + hero + ảnh tiệm từ Stitch export, tự host trong `public/images/`.

## 4. BE change request (bản nháp — cho slice thay mock)

> **Thay thế 2026-09-25** bởi spec đã duyệt [catalog/public-listing.md](../catalog/public-listing.md)
> (FR-CAT-09) — khác bản nháp dưới: `styles[]` (nhiều loại; trước 2026-09-30 là `occasions[]`), bỏ `styleLabel`,
> `rentalPricePerDay` → `rentalPrice` ("X / 2 ngày"), `retailPrice` nullable. Bản nháp giữ lại làm lịch sử.

`GET /api/v1/public/dresses` và `GET /api/v1/public/dresses/{slug}`, **không cần bearer**, DTO chỉ
chứa trường công khai (không giá vốn, không khách, không lịch):

```
PublicDressSummary { slug, name, tagline, style: 'short'|'silk'|'ao-dai'|'off-shoulder'|'sleeved'|'strappy-strapless',
                     styleLabel, badge: 'available'|'new'|'hot', rentalPricePerDay, retailPrice, cover: { src, alt } }
PublicDressDetail  = Summary + { description, images[], sizes: { label, available }[],
                     specs: { material, silhouette, length, color, styles } }
```

Mở: slug sinh từ `code`/`name`? `badge`/`style` lưu ở đâu (catalog chưa có)? ảnh công khai?
— trả lời khi làm BE slice.

## 5. As-built 2026-09-30 — dữ liệu thật (`web:public-catalog-live`)

Mock bị xoá; trang đọc `GET /public/dresses[/:slug]` qua client sinh ra (spec
[catalog/public-listing.md](../catalog/public-listing.md) §3–§4).

| Segment | Rendering | Cache owner |
| --- | --- | --- |
| `/`, `/bo-suu-tap`, `sitemap.xml` | ISR `revalidate = 300` | Next Data Cache, tag `public-dresses` |
| `/bo-suu-tap/[slug]` | ISR 300 s; slug có lúc build được prerender, slug đăng SAU build render ở request đầu rồi cache (`dynamicParams` mặc định = true) | như trên |

- **Cửa duy nhất**: `apps/web/src/api/public-catalog.ts` (`server-only`): `force-cache` +
  `revalidate: 300` + tag; 404 chi tiết → `null` → trang 404 tiếng Việt; lỗi khác ném ra (lúc
  revalidate: Next giữ bản cũ).
- **Build không có BE** (CI): BE *không kết nối được* trong `next build` → prerender danh mục rỗng
  + warning, lần revalidate đầu (≤ 5 phút sau khi có traffic) lấp dữ liệu. BE trả lỗi HTTP vẫn làm
  build đỏ. Deploy thật nên build khi API đang chạy.
- **Liên quan** tính từ danh sách đã cache (cùng ít nhất một loại trước, rồi phần còn lại), không
  thêm endpoint. Chip lọc: mẫu khớp khi `styles` chứa loại của chip.
- **DTO khác mock**: nhãn loại = `catalog.filter.<code>` nối bằng dấu phẩy; giá "X /lượt"
  (`common.price.perRental` — `rentalPrice` là giá một lượt thuê; "/ngày" chủ tiệm chốt sáng 2026-09-30, đổi sang "/lượt" tối cùng ngày); `retailPrice` null → ẩn giá gạch; ô thông số null không render, cả 5
  null → ẩn mục "Chi tiết thiết kế".
- **Ảnh**: `next/image` custom loader `src/lib/image-loader.ts` → `@dress-rental/image-url`
  (ảnh R2 dưới `NEXT_PUBLIC_IMAGE_BASE_URL` → biến thể Cloudflare Images; host khác và
  `/images/*` giữ nguyên). Độ rộng cố định: `deviceSizes [640, 828, 1200]`, `imageSizes [160, 320]`.
- Chưa làm: `revalidateTag('public-dresses')` khi CMS đăng/ẩn mẫu (cần route secret giữa BE và
  web) — hiện web chậm tối đa ~5 phút so với CMS.

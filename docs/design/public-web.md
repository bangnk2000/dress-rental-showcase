# public-web — Bootstrap brief (Level 1)

> Status: **skeleton as-built 2026-09-24**; trang công khai FR-WEB-01..04 trên dữ liệu mock
> 2026-09-25 → [web/public-pages.md](./web/public-pages.md) · SRS: chưa có FR-WEB-* ·
> API tags: chưa dùng tag nào · Spec: [init-nextjs](../spec/init-nextjs/README.md) §Usage Flow 1b +
> [init-monorepo-contract 01 §4b](../spec/init-monorepo-contract/01-workspace-structure.md)

Đây là bootstrap brief theo [init-nextjs 14 §1](../spec/init-nextjs/14-design-first.md), KHÔNG
phải slice design doc. Mỗi capability công khai sau này vẫn cần FR-id + tier riêng
([README §Quy trình](./README.md)); trang công khai/SEO mới mặc định là **design-tier** (14 §1).

## 0. Sản phẩm

`apps/web/` là website công khai (khách hàng, ẩn danh) của tiệm, render phía server bằng Next.js
16 App Router để SEO và first paint tốt. Nó là workspace sibling của `apps/fe` (staff SPA) và
`apps/qr-admin`: generated client, gates, AGENTS.md riêng; không import mã của app khác.

Phạm vi lần này: **chỉ dựng khung**. Chưa có trang nội dung nào ngoài placeholder "Sắp ra mắt".
Thay đổi phạm vi so với SRS §1 (trước đó ghi "trang công khai ngoài phạm vi repo") được ghi lại
trong [SRS-dress-rental.md](../SRS-dress-rental.md) §1.

## 1. Quyết định Phase 0

| Quyết định | Giá trị | Lý do |
| --- | --- | --- |
| Session owner | **Model 0 — không có session** ([05 §2](../spec/init-nextjs/05-auth-google.md)) | Khách ẩn danh; mọi thao tác staff nằm ở `apps/fe`. Thêm đăng nhập khách sau này = design-tier, chọn model A/B lúc đó |
| Ngôn ngữ | `vi` duy nhất, next-intl, `localePrefix: 'as-needed'` | Khách của tiệm là người Việt. Khung `[locale]` + `t()` đã có, thêm `en` = 1 dòng routing + 1 catalog |
| Contract | `packages/contract/openapi.json` (N1) | Một contract, sinh client thứ ba bằng `pnpm contract` |
| Gọi API | Server: `API_URL` trực tiếp. Browser: rewrite `/api/v1/*` → BE (N2) | Paths trong contract đã mang `/api/v1` |
| Cổng dev | `3001` (N4) | BE giữ `3000`, fe `5173`, qr-admin `5174` |
| Hosting | Một process Node riêng (N5): `output: 'standalone'` → `node .next/standalone/apps/web/server.js` (build ở máy khác, ship thư mục đó + `.next/static` + `public`) | VPS 2 GB không build/`pnpm install` được. **Bind `HOSTNAME=localhost`, KHÔNG `127.0.0.1`**: Next coi origin nội bộ là `localhost`, lệch với host bind thì rewrite của middleware next-intl (`/` → `/vi`) bị proxy ra ngoài → 307 lặp, và 500 sau reverse proxy gửi `X-Forwarded-Proto: https` (đo 2026-09-30, `next start` cũng bị). `API_URL` bị chốt vào rewrite `/api/v1` lúc BUILD |

## 2. Public / authenticated split + rendering

Chỉ có nhóm `(public)`; không có `(app)`.

| Segment | Group | Rendering (build route table) | Cache owner | SEO |
| --- | --- | --- | --- | --- |
| `/` (placeholder) | `(public)` | ● SSG qua `generateStaticParams` | không có data | `<title>` + description bản địa, canonical `/` |
| `/robots.txt`, `/sitemap.xml` | — | ○ static | — | `SITE_URL` |
| mọi path khác | — | ƒ `[...rest]` → `[locale]/not-found.tsx` (404 tiếng Việt) | — | — |

## 3. Bảng slice (seed cho `feature_list.json`)

Chưa có slice nào — chỉ entry `infra/web-bootstrap`. Slice đầu tiên sẽ đến từ một FR-WEB-* mới.

## 4. Contract gaps

| Gap | Quyết định |
| --- | --- |
| BE **không có endpoint công khai nào** (mọi operation trừ `auth/login`, `auth/refresh` đều cần bearer) — một trang catalogue công khai không thể gọi `GET /dresses` hiện tại | **Block**: mỗi trang công khai cần dữ liệu = BE change request trước (endpoint ẩn danh, DTO chỉ gồm trường được công khai — không lộ giá vốn/khách/lịch), rồi `pnpm contract`. Không bao giờ gọi API staff bằng token dịch vụ từ site công khai |
| Ảnh váy công khai | Block cùng lý do; quyết định khi có FR |

## 5. UI Foundation — design system "Romantic Parisian Muse"

Nguồn: [`apps/web/DESIGN.md`](../../apps/web/DESIGN.md) (chủ tiệm cung cấp 2026-09-24, lưu
nguyên văn) + hai ảnh demo bảng màu light/dark chủ tiệm gửi cùng ngày. Áp vào
`apps/web/src/app/globals.css` `@theme`:

| DESIGN.md | Tailwind v4 token → utility |
| --- | --- |
| frontmatter `colors.*` (scheme kiểu Material) | `--color-<tên>` giữ nguyên tên → `bg-primary`, `text-on-surface-variant`, `bg-surface-container`… |
| `typography.*` | `--text-<role>` (cỡ + line-height + tracking + weight) → `text-headline-lg`; họ font ghép riêng: `font-display` (Playfair Display) / `font-sans` (Plus Jakarta Sans), qua `next/font/google` subset `vietnamese` |
| `rounded.*` | `--radius-sm/md/lg/xl` + `rounded-default` (0.5rem); `rounded-full` sẵn có |
| `spacing.*` | `--spacing-<tên>` → `p-gutter`, `gap-space-lg`, `px-margin-mobile`… |
| shadow ambient (§Elevation) | `shadow-ambient` |
| hover của nút chính (không có trong frontmatter) | `primary-hover` = primary + 8% on-primary (state layer kiểu Material) |

### Quy tắc đã chốt: frontmatter là màu dùng, phần mô tả là màu gốc (seed)

Đo pixel trên ảnh demo light (2026-09-24): ô tiêu đề swatch mang đúng 4 hex của phần mô tả
(#8A4F58, #D4A3A1, #C5A880, #FBF8F5), nhưng **mọi component** dùng đúng giá trị frontmatter:
nút Primary / nav active / FAB 1 / bar 1 = #6E3841 `primary`; chip "Label" = #8A4F58
`primary-container` + chữ `on-primary-container`; bar 2 / FAB 2 = #7C5453 `secondary`; bar 3 /
FAB 3 = #5A4525 `tertiary`, ô bút chì = #745C3A `tertiary-container`; nút Inverted = #31302F
`inverse-surface`; nền card = #F0EDEA `surface-container`, nút Secondary + ô search = #EAE8E5
`surface-container-high`, khung ngoài = #DCDAD7 `surface-dim`; chữ Headline = #1B1C1A
`on-surface`, chữ Body/Label = #524345 `on-surface-variant`.

Nên 4 trong 5 mâu thuẫn ghi trước đó đã được giải:

1. Hành động chính = **`primary` #6E3841** (#8A4F58 là seed; dùng làm `primary-container` cho
   chip/nhãn).
2. Nền = **`background`/`surface` #FCF9F6** (#FBF8F5 là seed neutral).
3. Chữ = **`on-surface` #1B1C1A** cho tiêu đề, **`on-surface-variant` #524345** cho thân bài
   (#2E2625 không xuất hiện trong demo).
4. Secondary/tertiary = **#7C5453 / #5A4525** (#D4A3A1 / #C5A880 là seed).

Màu chỉ có trong công thức component của phần mô tả, quy về vai trò gần nhất khi slice đầu tiên
cần: viền card/input #EADBDA → `outline-variant`; chip chưa chọn #F5EFEA →
`surface-container`; dải ngày đã chọn #F3E3E2 → `primary-fixed`; hover #733F47 → `primary-hover`.

### Bo góc và dark theme — áp theo số đo trên ảnh demo (chủ tiệm chốt 2026-09-24)

5. **Bo góc:** nút, chip lọc và badge → **pill (`rounded-full`)**, theo DESIGN.md §Shapes và bản
   Stitch (`apps/web/design/stitch/`); card/input giữ token frontmatter (`rounded-lg` /
   `rounded-default`). *Chủ tiệm đổi 2026-09-25 — thay quyết định 2026-09-24 "nút `rounded-sm`
   theo góc gần vuông đo trên ảnh demo".*
   **Icon:** `lucide-react` (component SVG, tree-shaken); không nạp icon font / CDN (Material
   Symbols của Stitch quy về icon lucide gần nhất). Thêm dependency cùng slice đầu tiên dùng icon.
6. **Dark theme:** tự theo hệ điều hành (`prefers-color-scheme: dark`), ghi đè cùng tên token trong
   `globals.css`. (m) = đo từ ảnh dark, (d) = suy ra từ scheme light theo quy tắc tone của Material.
   Mọi giá trị (m) đều khớp quy tắc này, vd. dark `on-surface-variant` #D6C2C3 = light
   `outline-variant`, dark `on-error` #690005 = giá trị chuẩn Material:

   | Vai trò | Dark | Nguồn |
   | --- | --- | --- |
   | primary / on-primary | #FEB3BC / #51212A | m (nút, nav, FAB 1; icon FAB 1 + nav home khớp nhau) |
   | primary-container / on-primary-container | #8A4F58 / #FFD0D5 | m — giữ nguyên như light |
   | secondary / on-secondary | #EDBAB8 / #482727 | m (bar 2, FAB 2) |
   | secondary-container / on-secondary-container | #613D3C / #FFDAD8 | d |
   | tertiary / on-tertiary | #E0C298 / #4A2D18 | m (bar 3, FAB 3) |
   | tertiary-container / on-tertiary-container | #745C3A / #F6D6AB | m — giữ nguyên như light |
   | error / on-error | #FFB4AB / #690005 | m (FAB 4) |
   | error-container / on-error-container | #93000A / #FFDAD6 | d |
   | background, surface, surface-dim | #131312 | m (khung ngoài) |
   | surface-container / -high | #20201E / #2A2A28 | m (card / nút Secondary, search, nav) |
   | surface-container-lowest / -low / -highest, surface-bright | #0E0E0D / #1B1C1A / #353533 / #393937 | d |
   | on-surface, on-background, inverse-surface | #E5E2DF | m (chữ Headline, nút Inverted) |
   | on-surface-variant | #D6C2C3 | m (chữ Body/Label) |
   | inverse-on-surface / inverse-primary / surface-tint | #31302F / #884D56 / #FEB3BC | d |
   | outline / outline-variant / surface-variant | #9F8C8D / #524345 / #524345 | d (viền 1px trong ảnh bị hoà nền, không đo được) |
   | shadow-ambient | `rgba(0,0,0,.4)` | d — bóng ánh hồng không thấy được trên nền tối |

   Nhóm `*-fixed*` giống nhau ở cả hai theme (theo Material). Chưa có nút chuyển theme trong UI;
   thêm nút = design-tier nhỏ (lưu lựa chọn + chống nháy lúc tải trang).

Build giờ cần mạng tới Google Fonts (next/font tải font lúc build rồi tự host; CI có mạng).
Chưa cài shadcn component nào — slice đầu tiên thêm primitive và style chúng theo bảng trên.

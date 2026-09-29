# Mẫu công khai (public listing) + API catalogue ẩn danh — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `catalog` (Supporting) — aggregate MỚI `DressListing` |
| Status | **approved 2026-09-25** — chủ tiệm duyệt sau 3 vòng hỏi đáp (§6) |
| AC source | Chủ tiệm 2026-09-25: *"cập nhật logic backend và code cms để đáp ứng nhu cầu của `apps/web/src/api/mock`"* + hai vòng trả lời cùng ngày (§6). FR đề xuất: **FR-CAT-09** (mẫu công khai, quản lý trong CMS) + **FR-WEB-05** (web đọc catalogue thật) |
| Rules approved by | Chủ tiệm — từng dòng §6 "Đã chốt" |
| Contract approved by | Chủ tiệm 2026-09-25 (đại diện BE + CMS + web, cùng repo) |
| Liên quan | [dress-photo-upload.md](./dress-photo-upload.md) (ảnh R2 + Cloudflare Images — làm TRƯỚC; form mẫu dùng lại ô ảnh của nó) · [web/public-pages.md](../web/public-pages.md) §4 (change request nháp này thay thế) · [public-web.md](../public-web.md) §4 |

> Vì sao là design-tier: aggregate mới + invariant mới (slug duy nhất và khoá sau khi đăng, mẫu đã
> đăng phải có ảnh, dịp thuộc tập cố định) + state transition (nháp ↔ đã đăng) + quyền có điều kiện
> (xoá) + **API ẩn danh đầu tiên** của BE (cross-context contract với `apps/web`, bề mặt rò rỉ mới).

### Vì sao có aggregate riêng, không thêm cột vào `dresses`

Web nói về **một mẫu váy có nhiều size**; `dresses` là **một chiếc váy vật lý, một size, một mã**
— các size khác của cùng mẫu là bản sao `<code>_<n>` (FR-CAT-08). Đặt mô tả công khai lên từng
dòng `dresses` thì mỗi bản sao giữ một bản mô tả riêng và chúng trôi lệch nhau. `DressListing`
giữ nội dung công khai MỘT lần; váy được gắn vào mẫu qua bảng nối (một váy thuộc **nhiều** mẫu —
chủ tiệm chốt). Size, giá, "còn/hết" trên web đều **suy ra** từ các váy đang gắn — không lưu hai lần.

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Mẫu công khai (`listing`) | Nội dung một mẫu váy trên website: tên, slug, tagline, mô tả, các dịp, giá bán tham khảo, thông số, ảnh, cờ Hot, trạng thái đăng | bảng `dress_listings` |
| Váy thuộc mẫu | Cặp (mẫu, váy) trong `dress_listing_items`. Một váy thuộc **0..n** mẫu | chủ tiệm chốt 2026-09-25 |
| Đã đăng (`published`) | `published_at IS NOT NULL`. Chỉ mẫu đã đăng **và có ≥ 1 váy `active`** mới hiện trên web | nháp ↔ đã đăng, đổi được hai chiều |
| Đã từng đăng | `first_published_at IS NOT NULL` — không bao giờ quay về NULL | khoá slug (R2) |
| Loại (`style`) — trước 2026-09-30 là "Dịp" (`occasion`) | Mã thuộc tập cố định: `short` (Váy ngắn), `silk` (Váy lụa), `ao-dai` (Áo dài), `off-shoulder` (Váy trễ vai), `sleeved` (Váy che tay), `strappy-strapless` (Váy hai dây, cúp ngực). Một mẫu có **≥ 1** loại | cố định + `CHECK`; nhãn do FE/web dịch — xem §Amendment 2026-09-30 |
| Giá bán tham khảo (`retailPrice`) | Giá một chiếc mới ngoài thị trường, chỉ để khách so sánh | KHÁC `purchasePrice` (giá vốn, owner-only, KHÔNG BAO GIỜ ra web) |
| Giá thuê hiển thị | Các size của một mẫu **cùng giá** — web ghi **"X / 2 ngày"**, X = `min(rental_price)` của váy `active` thuộc mẫu (min chỉ là lưới an toàn khi dữ liệu lệch) | chủ tiệm chốt; CMS cảnh báo khi các váy gắn vào khác giá |
| Size còn/hết | Size = `size_label` của các váy thuộc mẫu (`NULL` → **"Freesize"**); **còn** = có ≥ 1 váy `active` size đó. KHÔNG xét lịch thuê | chủ tiệm chốt |
| Badge | `hot` nếu cờ Hot bật; ngược lại `new` nếu `first_published_at` ≤ 30 ngày; ngược lại `available` | chủ tiệm chốt; tính lúc đọc |

## 2. Use-case specification

```text
Use cases (MỘT feature — màn CMS "Website" cần đủ bộ):
  Commands (policy `listing:manage` — mọi nhân viên đã đăng nhập):
    CreateListing      POST   /listings
    UpdateListing      PATCH  /listings/:id
    SetListingDresses  PUT    /listings/:id/dresses        { dressIds: string[] } — danh sách ĐẦY ĐỦ (thay thế)
    PublishListing     POST   /listings/:id/publish
    UnpublishListing   POST   /listings/:id/unpublish
    DeleteListing      DELETE /listings/:id                — owner: luôn được; staff: chỉ mẫu CHƯA TỪNG đăng (§6.M)
  Reads (nhân viên):   GET /listings · GET /listings/:id
  Reads (ẨN DANH, @Public()):
    GET /public/dresses?occasion=&limit=     → PublicDressSummary[]
    GET /public/dresses/:slug                → PublicDressDetail | 404 envelope

Business input (Create; Update = mọi field tuỳ chọn):
  name (1–120) · slug? (bỏ trống → BE sinh từ name: bỏ dấu tiếng Việt, đ→d, a-z0-9 nối '-') ·
  tagline (≤ 160) · description (≤ 2000) · occasions (1..6 mã, không trùng) ·
  retailPrice (≥ 0, VND, nullable) · specs { material, silhouette, length, color, occasionsText }
  (mỗi ô ≤ 120, nullable) · photoUrls (0..10 url, ảnh đầu = bìa) · isHot (bool)

Business flow:
  CreateListing
    1. Guard listing:manage                                 → 403 envelope (guard)
    2. VO: slug sai định dạng / dịp lạ / 0 dịp / giá âm     → 400 envelope
    3. Pre-check slug trùng                                 → rejected_listing_slug_taken { slug }
    4. INSERT (nháp); UNIQUE(slug) bắn khi thua race        → rejected_listing_slug_taken { slug } (CÙNG outcome)
  UpdateListing
    1–2 như trên; mẫu không tồn tại                         → rejected_listing_not_found
    3. Đổi slug khi mẫu ĐÃ TỪNG ĐĂNG                        → rejected_listing_slug_locked
       (UPDATE slug có điều kiện `WHERE first_published_at IS NULL`; 0 dòng → cùng outcome —
        publish chen giữa load và save không lọt)
    4. Đổi slug → pre-check + UNIQUE như Create              → rejected_listing_slug_taken { slug }
    5. Mẫu ĐANG ĐĂNG mà photoUrls mới rỗng                  → rejected_listing_photo_required
       (CHECK `published ⇒ cardinality(photo_urls) ≥ 1` là lưới cuối, dịch về cùng outcome)
  SetListingDresses
    1. mẫu không tồn tại                                    → rejected_listing_not_found
    2. id váy không tồn tại                                 → rejected_dress_not_found { dressIds }
    3. Một transaction: DELETE cặp bị bỏ, INSERT … ON CONFLICT DO NOTHING cặp mới
       (váy retired gắn được — chỉ không hiện trên web)
  PublishListing
    1. mẫu không tồn tại                                    → rejected_listing_not_found
    2. không có ảnh HOẶC không có váy active nào            → rejected_listing_not_publishable { missing: ('photo'|'active_dress')[] }
    3. đã đăng rồi                                          → Ok (idempotent)
    4. published_at = now(); first_published_at = COALESCE(first_published_at, now())
  UnpublishListing: published_at = NULL (idempotent; ngoài not_found không từ chối)
  DeleteListing
    1. mẫu không tồn tại                                    → rejected_listing_not_found
    2. actor là staff VÀ mẫu ĐÃ TỪNG ĐĂNG (§6.M)
                                                            → 403 { status: 'forbidden', reason: 'listing_published_owner_only' }
       (DELETE có điều kiện cho staff; 0 dòng vì publish chen ngang → cùng outcome)
    3. DELETE mẫu; `dress_listing_items` ON DELETE CASCADE; váy không bị đụng
    Owner: không bao giờ bị từ chối ở bước 2 — FE hiện cảnh báo khi mẫu đang đăng.

Domain rules / invariants:
  R1 slug duy nhất, định dạng ^[a-z0-9]+(-[a-z0-9]+)*$, ≤ 80 ký tự.
  R2 slug KHÔNG đổi được sau lần đăng đầu tiên (chủ tiệm chốt — link đã chia sẻ không được 404).
  R3 Mẫu đang đăng luôn có ≥ 1 ảnh.
  R4 Mẫu có ≥ 1 dịp, mọi dịp thuộc tập cố định.
  R5 Web CHỈ thấy mẫu published_at IS NOT NULL VÀ có ≥ 1 váy active. Váy bị retire sau khi đăng →
     mẫu tự biến mất khỏi web khi hết váy active (không phải lỗi, không tự unpublish).
  R6 DTO công khai là WHITELIST: không `id` nội bộ, không `code`, `notes`, `depositAmount`,
     `purchasePrice`, `categoryId`, không thông tin khách/đơn/lịch.
  R7 Nhân bản váy (FR-CAT-08) chép MỌI cặp (mẫu, váy nguồn) sang bản sao, cùng transaction →
     bản sao `_n` thành một size mới của các mẫu đó.
  R8 Staff chỉ xoá mẫu chưa đăng; owner xoá mọi mẫu.

Side effects: không domain event consumer. Web tự làm mới bằng ISR 5 phút (chủ tiệm chốt).
Idempotency: Publish/Unpublish/SetListingDresses idempotent theo bản chất; Create dựa UNIQUE(slug).
Concurrency: slug race → UNIQUE; đổi slug vs publish → UPDATE có điều kiện; staff xoá vs publish →
  DELETE có điều kiện; hai người sửa cùng mẫu → last-write (như mọi aggregate khác).
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload |
| --- | --- | --- | --- |
| `rejected_listing_not_found` | mẫu không còn | 422 | — |
| `rejected_listing_slug_taken` | slug đã dùng (pre-check HOẶC race) | 422 | `slug` |
| `rejected_listing_slug_locked` | đổi slug của mẫu đã từng đăng | 422 | — |
| `rejected_listing_photo_required` | xoá hết ảnh của mẫu đang đăng | 422 | — |
| `rejected_listing_not_publishable` | thiếu điều kiện đăng | 422 | `missing: ('photo' \| 'active_dress')[]` |
| `rejected_dress_not_found` | (dùng lại) id váy không tồn tại | 422 | `dressIds[]` |
| `forbidden` + `reason: 'listing_published_owner_only'` | staff xoá mẫu đã đăng | 403 | `reason` (pattern `purchase_price_owner_only`) |

`GET /public/dresses/:slug` không thấy (chưa đăng / hết váy active) → **404 envelope**, không phải
outcome — web chỉ cần phân biệt "có" và "không".

### Invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| R1 slug duy nhất | `ListingSlug` VO + pre-check | `UNIQUE (slug)` + `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` | `rejected_listing_slug_taken` | e2e: API 422, 2 create song song → 1 thắng, INSERT thẳng bị chặn |
| R2 slug khoá | entity | UPDATE `… WHERE first_published_at IS NULL` (điều kiện nằm trong câu ghi) | `rejected_listing_slug_locked` | e2e: đổi sau publish → 422; publish ∥ đổi slug → không bao giờ vừa đăng vừa đổi |
| R3 đăng ⇒ có ảnh | entity | `CHECK (published_at IS NULL OR cardinality(photo_urls) >= 1)` | `rejected_listing_photo_required` / `not_publishable` | e2e: API + UPDATE thẳng bị CHECK |
| R4 dịp hợp lệ | `Occasion` VO | `CHECK (cardinality(occasions) >= 1 AND occasions <@ ARRAY['gala',…]::text[])` | 400 envelope | e2e: INSERT rác bị CHECK |
| Cặp (mẫu, váy) không trùng | set trong entity | `PRIMARY KEY (listing_id, dress_id)`, FK → listings `ON DELETE CASCADE`, FK → dresses `ON DELETE RESTRICT` | — | e2e: INSERT trùng bị PK |
| R8 staff xoá | service theo `actorRole` | DELETE `… WHERE first_published_at IS NULL` cho staff | 403 outcome | e2e: staff 403 + DB còn mẫu; owner 204 |
| Giá bán ≥ 0 | `Money` VO | `CHECK (retail_price >= 0)` | 400 envelope | unit VO |
| R6 whitelist | DTO riêng + SELECT cột tường minh | — (không phải luật dữ liệu) | — | e2e: so ĐÚNG tập key Summary/Detail |

### Contract (draft)

```text
PublicDressSummary { slug, name, tagline, occasions: Occasion[], badge: 'available'|'new'|'hot',
                     rentalPrice /* VND — web ghi "/ 2 ngày" */, retailPrice: number|null,
                     cover: { src, alt } }
PublicDressDetail  = Summary + { description, images: { src, alt }[], sizes: { label, available }[],
                     specs: { material, silhouette, length, color, occasions } /* string|null từng ô */ }
```

Khác mock: `occasion` → `occasions[]`; bỏ `occasionLabel` (web dịch từ mã — nhãn giữ như mock);
`rentalPricePerDay` → `rentalPrice` (giá một lượt 2 ngày, không phải giá/ngày); `retailPrice`
nullable. `src` là URL gốc (R2 hoặc link cũ) — việc tối ưu ảnh làm ở phía hiển thị
([dress-photo-upload.md](./dress-photo-upload.md) §Phân phối ảnh). `alt` do BE sinh: `"<name>"` cho
bìa, `"<name> — ảnh <n>"` cho ảnh sau. Thứ tự list: **Hot trước**, rồi `first_published_at` mới
nhất. `?occasion=` lọc mẫu có chứa dịp đó. Header `Cache-Control: public, max-age=60`. Váy liên
quan: web tự tính từ list (cùng ít nhất một dịp trước) — không thêm endpoint. Size: XS, S, M, L,
XL, rồi size tự do theo abc, "Freesize" cuối.

`ListingDto` (CMS) = mọi field của mẫu + `publishedAt`, `firstPublishedAt`, `dresses: { id, code,
name, sizeLabel, rentalPrice, status }[]` (một call đủ vẽ màn sửa). `DressResponseDto` thêm
`listings: { id, name }[]` cho dòng "Thuộc mẫu" ở chi tiết váy.

## 3. UI state matrix — CMS (`apps/fe`, feature mới `features/listings`)

### `/website` — danh sách mẫu (mọi nhân viên)

| State | Condition | Display / action |
| --- | --- | --- |
| loading | query list | skeleton bảng |
| empty | 0 mẫu | "Chưa có mẫu nào trên website" + nút **Tạo mẫu** |
| list | ≥ 1 | ảnh bìa, tên, các dịp, số size còn, badge **Nháp / Đã đăng / Ẩn (hết váy)**; bấm → sửa |
| error | 5xx / mạng | RouteBoundary retry |

### `/website/new` và `/website/:id` — form mẫu

| State | Condition | Display / action |
| --- | --- | --- |
| idle | — | tên (slug tự điền, sửa được khi chưa từng đăng), tagline, mô tả, **dịp (chọn nhiều, ≥ 1)**, giá bán, 5 ô thông số, **ô ảnh dùng chung** (upload R2 / thêm link / sắp xếp / bìa = ảnh đầu), công tắc Hot |
| slug khoá | `firstPublishedAt` ≠ null | ô slug chỉ đọc + chú thích "Đã đăng — không đổi được link" |
| gắn váy | section "Size & váy" | picker tìm váy theo mã/tên; nút **"Gắn cả nhóm mã"** thêm `<code>` + mọi `<code>_n`; bảng size với trạng thái active/retired |
| lệch giá | các váy gắn vào khác `rentalPrice` | cảnh báo vàng "Các size đang khác giá — web hiện giá thấp nhất" (không chặn) |
| submitting | mutation pending | disable nút, spinner (chặn double-submit) |
| `rejected_listing_slug_taken` | 422 | lỗi dưới ô slug: `listings:errors.slugTaken` |
| `rejected_listing_slug_locked` | 422 | lỗi dưới ô slug: `listings:errors.slugLocked` + refetch |
| `rejected_listing_photo_required` | 422 | lỗi ở ô ảnh: `listings:errors.photoRequired` |
| `rejected_listing_not_publishable` | 422 | toast liệt kê `missing`: `listings:errors.notPublishable.photo` / `.activeDress` |
| `rejected_dress_not_found` | 422 | toast + refetch picker |
| `rejected_listing_not_found` | 422 | toast + về `/website` |
| published | `publishedAt` ≠ null | badge + link **Xem trên web** (`<WEB_ORIGIN>/bo-suu-tap/<slug>`) + nút Ẩn khỏi web |
| xoá (owner, mẫu đang đăng) | — | dialog xác nhận **có cảnh báo** "Mẫu đang hiện trên website, link sẽ thành 404" |
| xoá (staff, mẫu đã đăng) | — | nút Xoá disabled + tooltip; nếu vẫn tới 403 `listing_published_owner_only` → toast `listings:errors.deleteOwnerOnly` |
| saved | 2xx | toast; invalidate `listings` list + detail key, và `dresses` (tập mẫu của váy đổi) |

`/dresses/:id`: thêm dòng "Thuộc mẫu: <tên>, <tên>" (link). Menu "Website" hiện cho mọi nhân viên.

### Web (`apps/web`) — entry `web:public-catalog-live`, không nằm trong feature này

Chip lọc: mẫu khớp khi `occasions` giao với tập của chip. 404 slug → trang 404 tiếng Việt đã có.
BE sập lúc revalidate → ISR giữ bản cũ.

## 4. FE data needs

| Screen | Calls |
| --- | --- |
| `/website` | `GET /listings` (kèm `dressCount`, `activeSizeCount`, `coverUrl`) |
| `/website/:id` | `GET /listings/:id` (kèm `dresses[]`) + picker dùng `GET /dresses?search=` đã có |
| web list / home | `GET /public/dresses` (một call; related tính từ đây) |
| web detail | `GET /public/dresses/:slug` + list đã cache |

## 5. Traceability skeleton

| AC | BE proof | FE proof |
| --- | --- | --- |
| R1 slug | e2e: 422, race 2 create, INSERT thẳng; unit slugify (dấu tiếng Việt, đ→d) | vitest: lỗi dưới ô slug |
| R2 slug khoá | e2e: đổi sau publish → 422; unpublish rồi đổi vẫn 422 | vitest: ô chỉ đọc |
| R3 ảnh | e2e: xoá hết ảnh mẫu đang đăng → 422; UPDATE thẳng bị CHECK | vitest |
| R4 dịp | e2e: 0 dịp / dịp lạ → 400; INSERT rác bị CHECK | vitest: chọn nhiều |
| R5 hiển thị | e2e: nháp → 404 public; đăng → 200; retire váy cuối → 404; không token → 200; `?occasion=` lọc đúng mẫu nhiều dịp | — |
| R6 whitelist | e2e: so ĐÚNG tập key Summary/Detail | — |
| R7 nhân bản | e2e: váy thuộc 2 mẫu → bản sao thuộc cả 2, size mới hiện ở public detail | — |
| R8 xoá | e2e: staff xoá mẫu đã đăng → 403 + mẫu còn; staff xoá nháp → 204; owner xoá mẫu đang đăng → 204 | vitest: cảnh báo owner, disabled staff |
| Publish | e2e: thiếu ảnh/váy → `missing` đúng; publish 2 lần giữ `first_published_at` | vitest toast |
| Badge | unit: hot > new(≤30 ngày) > available, biên đúng 30 ngày | — |
| Rate limit | e2e: vượt ngưỡng → 429 trên `/public/*`, route staff không bị ảnh hưởng | — |

## 6. Owner decisions

### Đã chốt (chủ tiệm, 2026-09-25)

| # | Câu hỏi | Chốt |
| --- | --- | --- |
| A | Giá thuê hiển thị | **"X / 2 ngày"**; các size **cùng giá** (không "từ X") |
| B | Size còn/hết | **Chỉ xét váy `active`**, không xét lịch |
| C | Badge | `new` = đăng ≤ 30 ngày, `hot` = bật tay, còn lại `available` |
| D | Dịp | **Tập 6 mã cố định**; một mẫu **nhiều dịp**; nhãn **giữ như mock** (tạm thời) |
| E | Ai quản lý mẫu | **Mọi nhân viên** (kể cả đăng/ẩn) |
| F | Ảnh | Upload thẳng từ CMS lên R2 + Cloudflare Images → [dress-photo-upload.md](./dress-photo-upload.md) |
| G | Một váy thuộc mấy mẫu | **Nhiều mẫu** |
| H | Váy không có size | **"Freesize"** |
| I | Xoá mẫu | **Owner** xoá mọi mẫu (chỉ cảnh báo); **staff** chỉ xoá mẫu chưa đăng |
| J | Thứ tự trang chủ | **Hot trước** (rồi mới đăng nhất) |
| K | Độ trễ web sau khi sửa | **ISR 5 phút** — chấp nhận |
| L | Đổi slug của mẫu đã đăng | **Không** |
| M | "Đã đăng" trong L và I nghĩa là gì | **Đã từng đăng** (`first_published_at IS NOT NULL`) — ẩn mẫu không mở khoá slug, không cho staff xoá |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| major | API ẩn danh đầu tiên — không có rate limit nào trong BE | §2 | `@nestjs/throttler` chỉ cho controller `public/*` (vd 60 req/phút/IP, key theo `X-Forwarded-For` sau nginx — bật `trust proxy`); nginx `limit_req` là lớp ngoài, ghi vào release lane |
| major | Rò rỉ: `dresses` có `purchase_price`, `notes`, `code` — một query public viết ẩu sẽ kéo ra | R6 | query handler public SELECT **danh sách cột tường minh** + DTO riêng; e2e so tập key |
| major | `rentalPricePerDay` của mock sai nghĩa (giá một lượt, không phải mỗi ngày) | Contract | đổi tên `rentalPrice`; web ghi hậu tố "/ 2 ngày" |
| minor | Web ISR gọi `/public/dresses` từ server Next — throttler không được chặn chính web (cùng IP VPS) | Rate limit | bỏ qua throttle cho IP loopback / header nội bộ; e2e route staff không bị ảnh hưởng |
| minor | `dress-lookup.adapter.ts` (rentals) đọc bảng `dresses` — bảng nối mới không đụng tới nó | catalog-aggregate §Cross-context | grep khi viết migration |
| minor | Code mới → thêm hàng ADR 0001 §3/§4 + key vi/en cùng commit | §2 | — |

Mục 3 (outcome coverage), 5 (read efficiency — mỗi màn ≤ 2 call), 7 (compatibility — chỉ THÊM
endpoint + field; `DressResponseDto.listings` là field mới bắt buộc nhưng chỉ client nội bộ đọc),
8 (idempotency): không có finding.

## Thứ tự làm (sau khi duyệt)

1. `catalog/dress-photo-upload` ([spec](./dress-photo-upload.md)) — BE presign → `pnpm contract` →
   CMS ô ảnh + `packages/image-url`.
2. `catalog/public-listing` (spec này) — migration + aggregate + public controller → `pnpm contract`
   → CMS `features/listings`.
3. `web:public-catalog-live` — web đổi thân `src/api/mock/public-catalog.ts` sang client sinh ra,
   SSG → ISR 300s, `next/image` loader Cloudflare, xoá `src/api/mock/`.

Mỗi bước = một entry ledger, một PR. Deploy (thêm process `apps/web`, nginx) thuộc release lane.

## As-built (2026-09-29, branch `feat/public-listing`)

BE `9f368ee`, CMS in the following commit. Choices the spec left open, taken conservatively:

| # | Choice |
| --- | --- |
| 1 | `tagline`/`description` optional on create, default `''`, stored NOT NULL — public DTOs always return strings |
| 2 | `GET /listings` rows carry `dressCount`, `activeDressCount`, `activeSizeCount`, `coverUrl`, `visibleOnWeb` (= published AND ≥ 1 active dress → badge "Ẩn (hết váy)") |
| 3 | `DressResponseDto.listings` is filled on get-dress AND list-dresses (one extra query per page) |
| 4 | `images` includes the cover first; alt `"<name> — ảnh <n>"` uses the 1-based position |
| 5 | Sizes: every attached dress contributes its size; a retired-only size shows `available: false`; free sizes sort `localeCompare('vi')` |
| 6 | `GET /public/dresses` without `limit` returns every visible listing (max 500) |
| 7 | Throttler per IP per route, `PUBLIC_THROTTLE_LIMIT`/`_TTL_SEC` (60/60), loopback skipped (`PUBLIC_THROTTLE_SKIP_LOOPBACK`, default true — the web's ISR server); `trust proxy` = loopback only, so a client-sent `X-Forwarded-For` cannot spoof the key; in-memory store = one API process |
| 8 | Owner delete hitting 0 rows → `rejected_listing_not_found`; staff 0 rows → re-read: row still there → 403 outcome, else not_found |
| 9 | Extra FE keys `listings:errors.dressNotFound` / `.notFound` (ADR 0001 §4) |
| 10 | Public controllers tagged `catalog` (tag = context) — web imports from `generated/catalog` |
| 11 | `@Public()` moved to `libs/authz/public.decorator.ts` (catalog may not import identity; identity re-exports it) |
| 12 | CMS: `/website/new` saves content only, then replaces the URL with `/website/:id` where "Size & váy" appears; "Gắn cả nhóm mã" = `GET /dresses?q=<code>&limit=100` filtered to `<code>` + `<code>_<n>` (retired included); "Xem trên web" needs `VITE_WEB_ORIGIN` at build time (hidden when unset) |

Release-lane items (not code): nginx must forward `X-Forwarded-For` for `/api/v1/public/*` and may add `limit_req`; `PUBLIC_THROTTLE_*` defaults suffice; `VITE_WEB_ORIGIN` in the CMS build.

## Amendment (2026-09-30, branch `feat/listing-styles`) — "Dịp" → "Loại"

Owner ask: classify a mẫu by **loại** (style) instead of **dịp** (occasion). Decisions: codes are
English slugs, labels live only in the translation files; the field is renamed end to end (DB,
API, three clients); existing listings need not keep meaning.

- Set: `short`, `silk`, `ao-dai`, `off-shoulder`, `sleeved`, `strappy-strapless` — labels
  "Váy ngắn", "Váy lụa", "Áo dài", "Váy trễ vai", "Váy che tay", "Váy hai dây, cúp ngực".
- Rename everywhere the sections above say `occasion`: column `occasions` → `styles`,
  `occasions_text` → `styles_text`; `Occasion(s)` VO → `Style(s)` (`style.value-object.ts`);
  request/response field `occasions` → `styles`, `specs.occasionsText` → `specs.stylesText`,
  public `specs.occasions` → `specs.styles`; query `?occasion=` → `?style=`.
- R4 unchanged as a rule (≥ 1, from the fixed set, no repeat) — migration
  `1755600000000_listing_styles` swaps the CHECK (`dress_listings_styles_check`) and rewrites old
  rows: `ao-dai` stays, every other old code becomes `silk` (staff re-tag in /website). Down
  migration reverses the rename (non-`ao-dai` → `gala`).
- Web (still on the mock): one filter chip per style plus "Tất cả"; mock dresses re-tagged.

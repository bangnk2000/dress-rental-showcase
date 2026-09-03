# catalog — Tactical Design

> Status: **as-built 2026-09-03** (FR-CAT-08 nhân bản + size chọn nút; 2026-08-10: FR-CAT-05 giá nhập + FR-CAT-06 sổ giá + FR-CAT-07 danh mục) · SRS: FR-CAT-01..08 · Context Supporting

## Vai trò & ranh giới

Sở hữu danh mục ~200 váy: định danh (mã), giá thuê, cọc chuẩn, ảnh (links), nhãn phân loại
(0..1 danh mục/váy), vòng đời active → retired. KHÔNG sở hữu tình trạng cho thuê — "đang thuê /
đang vệ sinh" là suy diễn từ `rental_items.blocked_period` của rentals (BR-5); catalog không có
cột nào cho việc đó.

## Aggregates

| Aggregate root | Entity nội bộ | Value objects | Enum/types |
| --- | --- | --- | --- |
| `DressEntity` | — | `DressCode` (mã duy nhất, chuẩn hóa; `baseOf`/`nextDuplicateOf` đánh số bản sao `_n`), `Money` (giá thuê, cọc chuẩn) | `DressStatus: active \| retired` · `photo_urls: text[]` · `category_id uuid NULL` |
| `CategoryEntity` | — | `CategoryName` (trim, 1-50, giữ nguyên hoa thường để hiển thị) | quan hệ nằm ở phía DRESS (FK nullable); category không biết váy nào thuộc nó |

Hành vi: `create()` (factory), `updateDetails()`, `changeCode()`, `retire()` — retire là
one-way (không có un-retire; cần thì là FR mới). Nhân bản (FR-CAT-08) không phải method của entity:
là một `create()` thứ hai từ props của váy nguồn, mã do service đánh số — xem §Nhân bản.

## State machine

| From | Action | To | Guard |
| --- | --- | --- | --- |
| active | `retire()` | retired | Permission `dress:retire` — **owner-only** (ABAC, `catalog.policies.ts`) |

Váy retired: không được thêm vào đơn mới (pre-check ở rentals qua `DressLookupPort`);
lịch sử đơn cũ giữ nguyên.

## Bảng invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| Mã váy duy nhất | `DressCode` VO + pre-check | `UNIQUE (code)` | outcome `rejected_dress_code_taken` (422) + `dressCode` ([ADR 0001](../adr/0001-outcome-model-at-the-http-boundary.md)) | `test:e2e` → `catalog-unique-code.e2e-spec.ts`: API 422 + INSERT trùng bị `UNIQUE` chặn |
| Tên danh mục duy nhất (không phân biệt hoa thường) | `CategoryName` VO + pre-check | `UNIQUE INDEX lower(name)` | outcome `rejected_category_name_taken` (422) + `name` — race dịch ở adapter (pattern DressCode) | `test:e2e` → `categories.e2e-spec.ts`: khác hoa thường, race 2 create, INSERT thẳng |
| Không xoá danh mục còn váy | pre-check `countDresses` | FK `dresses.category_id ... ON DELETE RESTRICT` | outcome `rejected_category_in_use` (422) + `dressCount`; DELETE thẳng bị FK chặn | `test:e2e`: API + raw DELETE |
| Váy chỉ trỏ danh mục tồn tại | pre-check `findOneById` khi gán | FK | outcome `rejected_category_not_found` (422) | `test:e2e` |
| Giá nhập là field của OWNER (FR-CAT-05) | create/update service so `actorRole` khi request CÓ MẶT field (kể cả null); read shaping: key chỉ tồn tại trên wire cho owner (staff = OMIT, không phải null) | `CHECK (purchase_price >= 0)` | 403 outcome `{ status: 'forbidden', reason: 'purchase_price_owner_only' }` — từ chối NÊU TÊN, không lặng lẽ bỏ field | `test:e2e` → `purchase-price.e2e-spec.ts`: staff write 403 + DB không đổi, so KEY hai token, CHECK chặn raw SQL |
| Đổi giá thuê/cọc mà không có dòng sử là trạng thái không tồn tại (FR-CAT-06) | service so trước/sau → `insertWithHistory` / `saveWithPriceHistory` (cùng transaction, không trigger); sổ append-only, không API sửa/xoá | `dress_price_history` FK + CHECK ≥ 0 | — (ghi sử không thể bị từ chối riêng) | `test:e2e` → `price-history.e2e-spec.ts`: v1 lúc tạo, +1/lần đổi thật, no-op khi gửi lại, atomicity khi write bị từ chối |
| Giá thuê / cọc ≥ 0 | `Money` VO | `CHECK (rental_price >= 0)`, `CHECK (deposit_amount >= 0)` | 400 envelope | unit VO (có) |
| Status hợp lệ | Entity | `CHECK (status IN ('active','retired'))` | outcome `rejected_dress_already_retired` (422) khi retire lại; `CHECK` là lưới cuối | unit entity (có) + e2e UPDATE rác bị chặn |

## Nhân bản (FR-CAT-08)

| Mục | Chốt |
| --- | --- |
| Endpoint | `POST /dresses/:id/duplicate` body `{ sizeLabel?: string hoặc null }` → 201 `{ id, code }`; permission `dress:create` (nhân bản LÀ tạo — staff được phép) |
| Mã bản sao | `DressCode.baseOf(mã nguồn)` bỏ hậu tố `_<digits>`, rồi `nextDuplicateOf(base, mã bắt đầu bằng base_)` = max + 1, chưa có thì `_1` (đánh số từ 1 — quyết định chủ tiệm 2026-09-03). Repo đọc bằng `starts_with()` — KHÔNG dùng LIKE vì `_` là wildcard |
| Race | hai thiết bị cùng đếm ra một `_n` → UNIQUE(code) từ chối bên thua → service đếm lại, tối đa 3 lần, rồi mới trả `rejected_dress_code_taken` (cùng outcome với create-dress, ADR 0001 §2) |
| Sao chép | tên, size (ghi đè được qua body), giá thuê, cọc, ghi chú, ảnh, danh mục, **giá nhập** (cùng model cùng giá vốn; không phải "staff SET field" — FR-CAT-05 nói về request MANG field, và read vẫn ẩn với staff); sổ giá v1 của bản sao ghi cùng transaction (`insertWithHistory`) |
| Proof | unit `duplicate-dress.service.spec.ts` (7 ca) + `dress-code.value-object.spec.ts`; `test:e2e` → `catalog-duplicate.e2e-spec.ts`: _1/_2/_3 kể cả sao-của-sao, race song song → hai mã KHÁC nhau, sổ giá v1, staff 201, mã có `_` nhập tay |

Quy ước mã theo đó thành `[A-Z0-9][A-Z0-9_-]{1,19}` (thêm `_`). MỌI hậu tố `_<digits>` được đọc là số
bản sao — `VD_012` nhập tay là bản sao #12 của `VD`; chấp nhận vì trước FR-CAT-08 mã chưa từng có `_`.
Size (FR-CAT-08b) là quyết định FE thuần: nút XS/S/M/L/XL, API giữ text tự do ≤ 20.

## Persistence sketch

Bảng `dresses` (id, code UNIQUE, size, rental_price, deposit_amount, status, `photo_urls
text[]`, `category_id uuid NULL REFERENCES categories ON DELETE RESTRICT`, timestamps) ·
`categories` (id, name + UNIQUE lower(name), timestamps). Ảnh là LINK (không upload/storage —
ngoài phạm vi MVP). Seed một lần: `pnpm --filter be import:dresses <csv>` — cột `category`
optional, tên chưa có thì TỰ TẠO (FR-CAT-07 §6.Q2).

Policy: `category:create/update` mọi staff; `category:delete` owner-only (§6.Q1).
Read: `DressResponseDto.categoryId` (nullable) — TÊN join phía client từ `GET /categories`
(danh sách ~10 dòng, cache) thay vì denormalize vào từng dòng váy; ghi rõ trong `@ApiProperty`.

## Cross-context

Catalog không đọc context nào. Bị rentals đọc bảng `dresses` qua `dress-lookup.adapter.ts`
(deviation #4 — đổi schema `dresses` phải grep adapter đó).

## Domain events

`DressCreated / DressRetired` — 0 consumer (chờ nhu cầu thật).

## Open questions

- ~~Kích thước/size hiện là text tự do~~ — **2026-09-03 (FR-CAT-08b)**: form chọn bằng nút
  XS/S/M/L/XL; API vẫn text ≤ 20 (dữ liệu CSV cũ giữ nguyên, hiện thành nút thứ sáu khi sửa).
  Filter theo size vẫn chưa có — FR mới nếu cần.

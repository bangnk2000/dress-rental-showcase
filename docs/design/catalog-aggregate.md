# catalog — Tactical Design

> Status: **as-built 2026-08-02** · SRS: FR-CAT-01..04 · Context Supporting

## Vai trò & ranh giới

Sở hữu danh mục ~200 váy: định danh (mã), giá thuê, cọc chuẩn, ảnh (links), vòng đời
active → retired. KHÔNG sở hữu tình trạng cho thuê — "đang thuê / đang vệ sinh" là suy diễn
từ `rental_items.blocked_period` của rentals (BR-5); catalog không có cột nào cho việc đó.

## Aggregates

| Aggregate root | Entity nội bộ | Value objects | Enum/types |
| --- | --- | --- | --- |
| `DressEntity` | — | `DressCode` (mã duy nhất, chuẩn hóa), `Money` (giá thuê, cọc chuẩn) | `DressStatus: active \| retired` · `photo_urls: text[]` |

Hành vi: `create()` (factory), `updateDetails()`, `changeCode()`, `retire()` — retire là
one-way (không có un-retire; cần thì là FR mới).

## State machine

| From | Action | To | Guard |
| --- | --- | --- | --- |
| active | `retire()` | retired | Permission `dress:retire` — **owner-only** (ABAC, `catalog.policies.ts`) |

Váy retired: không được thêm vào đơn mới (pre-check ở rentals qua `DressLookupPort`);
lịch sử đơn cũ giữ nguyên.

## Bảng invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| Mã váy duy nhất | `DressCode` VO + pre-check | `UNIQUE (code)` | 409 | GAP #5 (chưa có test khiêu khích) |
| Giá thuê / cọc ≥ 0 | `Money` VO | `CHECK (rental_price >= 0)`, `CHECK (deposit_amount >= 0)` | 400 | unit VO (có) |
| Status hợp lệ | Entity | `CHECK (status IN ('active','retired'))` | 409 | unit entity (có) |

## Persistence sketch

Bảng `dresses` (id, code UNIQUE, size, rental_price, deposit_amount, status, `photo_urls
text[]`, timestamps). Ảnh là LINK (không upload/storage — ngoài phạm vi MVP).
Seed một lần: `pnpm --filter be import:dresses <csv>` (CSV parser có 9 unit test).

## Cross-context

Catalog không đọc context nào. Bị rentals đọc bảng `dresses` qua `dress-lookup.adapter.ts`
(deviation #4 — đổi schema `dresses` phải grep adapter đó).

## Domain events

`DressCreated / DressRetired` — 0 consumer (chờ nhu cầu thật).

## Open questions

- Kích thước/size hiện là text tự do — nếu cần filter chuẩn hóa → FR mới (standard-tier).

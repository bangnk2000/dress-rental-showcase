# rentals — Tactical Design

> Status: **as-built 2026-08-02** · SRS: FR-RENT-01..08, BR-1..3, BR-5..6 · Context **Core**

## Vai trò & ranh giới

Sở hữu toàn bộ vòng đời đơn thuê: đặt (booked) → lấy (out) → trả (returned) / hủy (cancelled),
lịch block per-váy (kể cả buffer vệ sinh), và các read surface vận hành (availability,
booked-ranges, today-board, list). KHÔNG sở hữu: danh mục váy (catalog), bảng tiền (payments —
rentals chỉ GHI settlement qua port khi return).

## Aggregates

| Aggregate root | Entity nội bộ | Value objects | Enum/types |
| --- | --- | --- | --- |
| `RentalEntity` — 1 đơn thuê của 1 khách | `RentalItemEntity[]` — mỗi váy trong đơn, mang `blocked_period` + cờ `blocking` | `RentalPeriod` (khoảng ngày ĐÓNG `[start,end]`, có `extendEndByDays()` cho buffer), `Money` (VND integer, libs) | `RentalStatus: booked \| out \| returned \| cancelled` |

Aggregate trải **2 bảng** (`rentals` + `rental_items`) — repository override
`insert/save/findOneById` để ghi cả hai trong MỘT transaction.

## State machine (`RentalEntity`, method trả `Result<void, DomainError>`)

| From | Action (method) | To | Ghi chú |
| --- | --- | --- | --- |
| booked | `markPickedUp(now)` | out | FR-RENT-04 |
| booked, out | `markReturned(now)` | returned | items TIẾP TỤC block hết buffer = "đang vệ sinh" (BR-5) |
| booked | `cancel(now)` | cancelled | `item.unblock(now)` từng item → giải phóng lịch, giữ history (FR-RENT-06) |

Mọi transition khác → `Err(...NotAllowedError)` → controller map 409.

## Bảng invariant-enforcement (mục load-bearing — spec 14 §3.1)

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| BR-1: một váy không bị block trùng khoảng (kể cả buffer) | `findBlockedDressIds()` pre-check → `DressUnavailableError` | `EXCLUDE USING gist (dress_id WITH =, blocked_period WITH &&) WHERE (blocking)` + `btree_gist` | 409 `RENTALS.DRESS_UNAVAILABLE` (repo bắt exclusion violation) | **GAP #5** — chưa có test tự động khiêu khích constraint (evidence hiện tại: smoke.sh + psql thủ công) |
| BR-2: một váy không xuất hiện 2 lần trong 1 đơn | DTO `@ArrayUnique` + `validate()` của entity | `UNIQUE (rental_id, dress_id)` | 400 / 409 | GAP #5 |
| BR-3: status hợp lệ | State machine trong entity | `CHECK (status IN (...))` | 409 | unit test entity (có) |
| Giá item ≥ 0 | `Money` VO | `CHECK (price >= 0)` | 400 | unit VO (có) |

Concurrency: KHÔNG cần version column — invariant race-sensitive duy nhất (BR-1) đã được
EXCLUDE đóng; hai staff cùng thao tác một đơn là kịch bản chấp nhận last-write cho MVP
(quyết định falsifiable — xét lại nếu tiệm thêm thiết bị).

## Persistence sketch

`rentals` (id, customer_name, customer_phone, status, deposit, note, timestamps) ·
`rental_items` (id, rental_id FK, dress_id FK, price, blocked_period **daterange**, blocking).
Quy ước daterange: domain dùng inclusive `[start,end]`; Postgres normalize half-open
`[start,end+1)` — convert DUY NHẤT tại `database/daterange.ts`, mọi SELECT lấy `period::text`.

## Cross-context

| Kênh | Chi tiết | Trạng thái |
| --- | --- | --- |
| `DressLookupPort` ← `dress-lookup.adapter.ts` | ĐỌC THẲNG bảng `dresses` của catalog | **Deviation #4** (apps/be/AGENTS.md) — spec 14 §3.2 cấm; giữ có chủ ý, migration path = contract query |
| `PaymentRecorderPort` ← `payment-recorder.adapter.ts` | GHI THẲNG bảng `payments` khi return (BR-6: ghi SAU flip status) | Deviation #4 — như trên |

## Domain events

`RentalCreated / PickedUp / Returned / Cancelled` — publish trong transaction, **0 consumer**
(hạ tầng chờ nhu cầu thật; không xây listener/outbox trước khi có — spec 01 §8).

## Open questions

- Proof test cho BR-1/BR-2 (gap #5) — candidate hàng đầu, cần compose Postgres trong CI.
- Phí trễ hạn hiện nhập tay lúc return; nếu muốn tự tính theo ngày trễ → FR mới + design-tier.

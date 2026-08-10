# rentals — Tactical Design

> Status: **as-built 2026-08-10** (ADR 0001 + BR-1/2/3 proof tests trên Postgres thật + FR-RENT-09 phí trễ hạn + FR-RENT-10 pickup gate) · SRS: FR-RENT-01..10, BR-1..3, BR-5..6 · Context **Core**

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
| *(create, start ≤ shopToday)* | `create()` + `markPickedUp(now)` | out | **FR-RENT-10**: đơn giao ngay/nhập bù sinh ra đã `out`; cả hai event cùng transaction |
| booked | `markPickedUp(now)` | out | FR-RENT-04 |
| out | `markReturned(now)` | returned | **CHỈ từ out** (FR-RENT-10 bỏ lối tắt booked→returned); items TIẾP TỤC block hết buffer = "đang vệ sinh" (BR-5) |
| booked, out | `cancel(now)` | cancelled | `item.unblock(now)` từng item → giải phóng lịch, giữ history (FR-RENT-06). Đơn `out` (và cả `booked`) chỉ huỷ được khi **sổ tiền TRỐNG** — check dưới row lock trong `saveCancelled` (repository), race với record-collection lấy cùng lock nên take turns |

Mọi transition khác → `Err(...NotAllowedError)` → controller render outcome
`rejected_{pickup,return,cancel}_not_allowed` (422) kèm `currentStatus`; sổ có tiền →
`rejected_cancel_has_payments` ([ADR 0001](../adr/0001-outcome-model-at-the-http-boundary.md) §3).

## Bảng invariant-enforcement (mục load-bearing — spec 14 §3.1)

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| BR-1: một váy không bị block trùng khoảng (kể cả buffer) | `findBlockedDressIds()` pre-check → `DressUnavailableError` | `EXCLUDE USING gist (dress_id WITH =, blocked_period WITH &&) WHERE (blocking)` + `btree_gist` | outcome `rejected_dress_unavailable` (422) + `dressIds` — **cả pre-check lẫn đường race** (repo throw `RentalItemsOverlapError`, service đổi thành cùng outcome) | `pnpm --filter be test:e2e` → `rentals-overlap.e2e-spec.ts` trên Postgres thật: pre-check, race song song, và INSERT thẳng vào DB đều bị chặn |
| BR-2: một váy không xuất hiện 2 lần trong 1 đơn | DTO `@ArrayUnique` + `validate()` của entity | `UNIQUE (rental_id, dress_id)` | 400 envelope `GENERIC.VALIDATION` (DTO) / `GENERIC.ARGUMENT_INVALID` (entity) | e2e: 400 qua API + INSERT trùng bị `UNIQUE` chặn |
| BR-3: status hợp lệ | State machine trong entity | `CHECK (status IN (...))` | outcome `rejected_*_not_allowed` (422) qua state machine; `CHECK` chỉ là lưới cuối | unit test entity (có) + e2e: UPDATE status rác bị `CHECK` chặn |
| Giá item ≥ 0 | `Money` VO | `CHECK (price >= 0)` | 400 envelope | unit VO (có) |

## Phí trễ hạn (FR-RENT-09)

| Mục | Chốt |
| --- | --- |
| Quy tắc | `daysLate` = số ngày dương lịch **sau** `period.end` (đệm giặt không tính); `suggestedLateFee = daysLate × số item × LATE_FEE_PER_DRESS_PER_DAY` (200.000₫, env) |
| Nơi sống | `domain/late-fee.value-object.ts` (hàm thuần) + `RentalEntity.lateFeeQuote()` — read side gọi chính nó, **không** có bản copy SQL thứ hai |
| Ngày tham chiếu | `shopToday()` (`Asia/Ho_Chi_Minh`) — tiền không được phụ thuộc đồng hồ UTC của VPS. Khác với today-board (lấy ngày từ thiết bị, vì nhân viên có thể cố ý xem ngày khác) |
| Miễn/giảm | thu ít hơn đề xuất: chỉ `owner` (outcome 403 `forbidden`) và **bắt buộc note** (422 `rejected_waiver_note_required`); thu nhiều hơn thì tự do |
| Ghi nhận | `payments` luôn ghi số THỰC THU, không phải số đề xuất |
| Proof | unit `late-fee.value-object.spec.ts` + `return-rental.service.spec.ts`; provider `test:e2e` → `late-fee.e2e-spec.ts` (8 ca) |

Chi tiết + lý do: [rentals/settle-late-fee.md](./rentals/settle-late-fee.md) · outcome catalog:
[ADR 0001](../adr/0001-outcome-model-at-the-http-boundary.md) §3.

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

- ~~Proof test cho BR-1/BR-2 (gap #5)~~ — **đã đóng 2026-08-09**: `apps/be/test/rentals-overlap.e2e-spec.ts`
  chạy trên Postgres thật (`pnpm --filter be test:e2e`), CI có postgres service.
- ~~Phí trễ hạn nhập tay~~ — **đã làm 2026-08-10** (tự tính + miễn giảm có kiểm soát quyền):
  **FR-RENT-09** → [rentals/settle-late-fee.md](./rentals/settle-late-fee.md) (status `as-built`);
  xem mục §Phí trễ hạn ở trên.

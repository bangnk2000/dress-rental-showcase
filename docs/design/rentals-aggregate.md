# rentals — Tactical Design

> Status: **as-built 2026-09-18** (FR-RENT-12/13 chi tiết + sửa đơn owner-only; 2026-09-03: FR-RENT-11 giảm giá; 2026-08-10: ADR 0001 + BR-1/2/3 proof tests trên Postgres thật + FR-RENT-09 phí trễ hạn + FR-RENT-10 pickup gate) · SRS: FR-RENT-01..13, BR-1..3, BR-5..6 · Context **Core**

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
| booked, out | `update(changes, now, buffer)` | *(không đổi)* | **FR-RENT-13** (owner-only): viết lại NỘI DUNG — khách, kỳ thuê, item (reconcile theo id: giữ/thêm/bỏ — bỏ = XOÁ dòng), giá item, giảm giá, ghi chú; mọi item `reblock` = kỳ mới + buffer HIỆN HÀNH; `validate()` chạy lại (giảm giá ≤ Σ mới). KHÔNG đổi status. `saveUpdated` đọc lại status dưới row lock → `RentalStateChangedError` nếu đơn vừa bị đóng |

Mọi transition khác → `Err(...NotAllowedError)` → controller render outcome
`rejected_{pickup,return,cancel,update}_not_allowed` (422) kèm `currentStatus`; sổ có tiền →
`rejected_cancel_has_payments` ([ADR 0001](../adr/0001-outcome-model-at-the-http-boundary.md) §3).

## Bảng invariant-enforcement (mục load-bearing — spec 14 §3.1)

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| BR-1: một váy không bị block trùng khoảng (kể cả buffer) | `findBlockedDressIds()` pre-check → `DressUnavailableError` | `EXCLUDE USING gist (dress_id WITH =, blocked_period WITH &&) WHERE (blocking)` + `btree_gist` | outcome `rejected_dress_unavailable` (422) + `dressIds` — **cả pre-check lẫn đường race** (repo throw `RentalItemsOverlapError`, service đổi thành cùng outcome) | `pnpm --filter be test:e2e` → `rentals-overlap.e2e-spec.ts` trên Postgres thật: pre-check, race song song, và INSERT thẳng vào DB đều bị chặn |
| BR-2: một váy không xuất hiện 2 lần trong 1 đơn | DTO `@ArrayUnique` + `validate()` của entity | `UNIQUE (rental_id, dress_id)` | 400 envelope `GENERIC.VALIDATION` (DTO) / `GENERIC.ARGUMENT_INVALID` (entity) | e2e: 400 qua API + INSERT trùng bị `UNIQUE` chặn |
| BR-3: status hợp lệ | State machine trong entity | `CHECK (status IN (...))` | outcome `rejected_*_not_allowed` (422) qua state machine; `CHECK` chỉ là lưới cuối | unit test entity (có) + e2e: UPDATE status rác bị `CHECK` chặn |
| Giá item ≥ 0 | `Money` VO | `CHECK (price >= 0)` | 400 envelope | unit VO (có) |
| FR-RENT-11: giảm giá ≥ 0 và ≤ Σ giá item | `Money` VO (≥ 0) + `RentalEntity.validate()` (≤ Σ — rule trải 2 bảng nên chỉ aggregate giữ được) | `CHECK (discount_amount >= 0)` (migration 1755400000000) | 400 envelope: `GENERIC.VALIDATION` (âm, DTO) / `GENERIC.ARGUMENT_INVALID` (vượt Σ) | unit `create-rental.service.spec.ts` (4 ca) + `test:e2e` → `rental-discount.e2e-spec.ts`: lưu + list đọc lại, vượt Σ → 400 không ghi gì, UPDATE âm bị CHECK chặn |
| BR-1 **xuyên suốt sửa đơn** (FR-RENT-13): kỳ block MỚI của mọi item không giao với đơn khác | `findBlockedDressIds(…, { excludeRentalId })` pre-check trên kỳ mới + buffer, bỏ qua dòng của chính đơn | CÙNG `EXCLUDE rental_items_no_overlap` — UPDATE một dòng không bị so với chính nó, nhưng bị so với mọi dòng khác | `rejected_dress_unavailable` (422) + `dressIds` — pre-check LẪN race (`saveUpdated` → `RentalItemsOverlapError` → cùng outcome) | `rental-update.e2e-spec.ts`: gia hạn trùng đơn khác 422 / vào chỗ trống 200 (block của mọi item dời theo), race PATCH-vs-POST đúng một bên thắng, raw UPDATE `blocked_period` chồng lên đơn khác bị EXCLUDE chặn |
| FR-RENT-13: chỉ đơn MỞ mới sửa được, và đơn đã đóng không bị bản sửa cũ mở lại | `RentalEntity.update()` + service pre-check `isOpen` | Không có constraint tĩnh diễn đạt được "dòng đã đóng thì bất biến" → **row lock + đọc lại status** trong `saveUpdated` (`SELECT … FOR UPDATE`, cùng lock với `saveCancelled`/`saveReturned`/record-collection) | `rejected_update_not_allowed` (422) + `currentStatus` — cả pre-check lẫn đường lock | unit `update-rental.service.spec.ts` (đóng trước / đóng dưới lock) + e2e: cancel rồi PATCH → 422, row và item không đổi |

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

## Giảm giá (FR-RENT-11)

| Mục | Chốt |
| --- | --- |
| Mức | ĐƠN (`rentals.discount_amount`, `RentalProps.discount: Money`), không per item — `rental_items.price` vẫn là giá thoả thuận từng váy, không bị chia hay trừ |
| Không phải dòng tiền | `payments` ghi số THỰC THU; giảm giá chỉ đổi số GỢI Ý tiền thuê khi ghi nhận thu (`Σ agreedPrice − discountAmount`, FE `record-collection-form`) |
| Read | `RentalListItemDto.discountAmount` (list); today-board không mang (không có màn hình tiền ở đó) |
| FE | form tạo đơn: ô "Giảm giá (VND)" đọc lại số đã gộp nhóm; picker hiện Tạm tính / Giảm / Tiền thuê sau giảm; vượt tạm tính bị chặn ngay ở form (`form.errors.discountTooLarge`) trước khi gọi API |

## Sửa đơn (FR-RENT-13) + chi tiết đơn (FR-RENT-12)

| Mục | Chốt |
| --- | --- |
| Quyền | `PATCH /rentals/:id` = `rental:update`, policy **owner-only** (quyền ghi owner-only đầu tiên của rentals); staff → 403 envelope (guard). `GET /rentals/:id` = read, mọi nhân viên |
| Trạng thái | Chỉ `booked`/`out`; update KHÔNG đổi status (không auto-`out` như create — §6.Q3 của spec) |
| Item | Danh tính = váy: giữ lại → cùng dòng + giá thoả thuận (trừ khi gửi `price`); thêm mới → dòng mới + giá chuẩn (trừ khi gửi `price`); bỏ → **XOÁ dòng** (`writeAggregate` xoá các id không còn trong aggregate ở mọi đường upsert — các đường cũ không bớt item nên no-op). Váy giữ lại đã retired KHÔNG chặn; váy thêm mới retired → `rejected_dress_retired` |
| Lịch block | Sau sửa, MỌI item = kỳ mới + `CLEANING_BUFFER_DAYS` hiện hành (kể cả khi chỉ sửa tên) |
| Concurrency | Sửa vs đóng đơn: row lock + đọc lại status (`saveUpdated`); sửa vs đặt/sửa đơn khác cùng váy: EXCLUDE; hai owner cùng sửa một đơn: last-write (MVP) |
| Read | `RentalDetailDto` = siêu tập `RentalListItemDto` (+ `updatedAt`, `dresses[].blockedUntilDate/blocking`) — dialog tiền dùng chung không cần adapter. Controller get-rental đăng ký CUỐI module (route `:id` sau `today-board`) |
| FE | `/rentals/:id` (mọi nhân viên; nút Sửa chỉ owner), `/rentals/:id/edit` (owner; `RentalForm` dùng chung với `/rentals/new`; picker bỏ qua conflict có `rentalId` = đơn đang sửa) |

Chi tiết + các quyết định mặc định chờ chủ tiệm xác nhận: [rentals/update-rental.md](./rentals/update-rental.md) §6.

## Persistence sketch

`rentals` (id, customer_name, customer_phone, period **daterange**, status, notes, discount_amount, timestamps) ·
`rental_items` (id, rental_id FK, dress_id FK, price, blocked_period **daterange**, blocking).
Quy ước daterange: domain dùng inclusive `[start,end]`; Postgres normalize half-open
`[start,end+1)` — convert DUY NHẤT tại `database/daterange.ts`, mọi SELECT lấy `period::text`.

## Cross-context

| Kênh | Chi tiết | Trạng thái |
| --- | --- | --- |
| `DressLookupPort` ← `dress-lookup.adapter.ts` | ĐỌC THẲNG bảng `dresses` của catalog | **Deviation #4** (apps/be/AGENTS.md) — spec 14 §3.2 cấm; giữ có chủ ý, migration path = contract query |
| `PaymentRecorderPort` ← `payment-recorder.adapter.ts` | GHI THẲNG bảng `payments` khi return (BR-6: ghi SAU flip status) | Deviation #4 — như trên |

## Domain events

`RentalCreated / PickedUp / Returned / Cancelled / Updated` — publish trong transaction, **0 consumer**
(hạ tầng chờ nhu cầu thật; không xây listener/outbox trước khi có — spec 01 §8).

## Open questions

- ~~Proof test cho BR-1/BR-2 (gap #5)~~ — **đã đóng 2026-08-09**: `apps/be/test/rentals-overlap.e2e-spec.ts`
  chạy trên Postgres thật (`pnpm --filter be test:e2e`), CI có postgres service.
- ~~Phí trễ hạn nhập tay~~ — **đã làm 2026-08-10** (tự tính + miễn giảm có kiểm soát quyền):
  **FR-RENT-09** → [rentals/settle-late-fee.md](./rentals/settle-late-fee.md) (status `as-built`);
  xem mục §Phí trễ hạn ở trên.

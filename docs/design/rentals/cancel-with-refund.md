# Huỷ đơn đã trả trước, kèm ghi tiền hoàn — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `rentals` (Core) — chủ của cancel; ghi dòng hoàn vào sổ `payments` qua `PaymentRecorderPort` (cùng đường với return flow) |
| Status | **approved 2026-11-07** (§6 Q1–Q5, mọi đề xuất được chấp nhận). Chủ tiệm **chọn bỏ vòng prototype** (2026-11-07) — §3 state matrix là bản thiết kế UI; ledger `rentals/cancel-with-refund` = in-progress |
| AC source | [deposit-at-pickup](./deposit-at-pickup.md) §6.Q8, chủ tiệm chốt 2026-11-07: *"huỷ kèm ghi tiền hoàn — dialog huỷ hỏi số tiền trả lại khách: cọc hoàn đủ, tiền thuê hoàn tuỳ (phần giữ lại = phí huỷ); sổ ghi dòng hoàn rồi đơn chuyển Đã huỷ"*; tách feature, ship TRƯỚC deposit-at-pickup |
| FR | **FR-RENT-06 sửa (đề xuất, §5)** — vào SRS cùng PR code |
| Rules approved by | Chủ tiệm — 2026-11-07 (§6) |

> Vì sao design-tier: **đổi state transition đã duyệt** (FR-RENT-06 §6.Q2 — huỷ chỉ khi sổ trống),
> thêm **kind mới** trong CHECK của `payments` (migration), và thêm luật tiền có race với
> record-collection (số hoàn tính trên số đã thu, số đã thu có thể đổi đến tận lúc ghi).

### Vấn đề hôm nay (as-built)

`saveCancelled` đếm dòng `payments` dưới row lock: có ≥ 1 dòng → `rejected_cancel_has_payments`,
áp cho cả `booked` (`rental.repository.ts`). Return chỉ đi từ `out` (FR-RENT-10a). ⇒ Đơn `booked`
đã ghi cọc/tiền thuê qua dialog "Tiền của lượt thuê" **không có lối ra**: không huỷ được, không trả
được (chỉ có thể giao rồi trả — sai sự thật). Hôm nay hiếm; sau deposit-at-pickup thì thường.

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Huỷ có tiền | Huỷ một đơn mà sổ đã có dòng `deposit` và/hoặc `rental_fee` | mới |
| Hoàn cọc (`deposit_refund`) | Tiền cọc trả lại khách | kind đã có (return flow) — nay cancel cũng sinh |
| Hoàn tiền thuê (`rental_fee_refund`) | Tiền thuê trả lại khách khi huỷ | **kind mới** (migration CHECK) |
| Phí huỷ / tiền giữ lại | (cọc đã thu − hoàn cọc) + (tiền thuê đã thu − hoàn tiền thuê) | **không phải dòng sổ** — là phần chênh, suy ra từ sổ |

## 2. Use-case specification

```text
Use case: CancelRental (mở rộng) — POST /api/v1/rentals/:id/cancel
Actor: staff (huỷ + hoàn đủ); owner (được giữ lại tiền — Q3)
Authorization: rental:cancel (không đổi) + luật giữ tiền ở bước 6

Business input (body MỚI, toàn field tuỳ chọn — client cũ gửi rỗng vẫn hợp lệ):
  - depositRefund?:   VND integer ≥ 0
  - rentalFeeRefund?: VND integer ≥ 0
  - expectedDepositCollected?:   số cọc đã thu mà màn hình đã thấy (basis)
  - expectedRentalFeeCollected?: số tiền thuê đã thu mà màn hình đã thấy (basis)
  - note?: ghi lên mọi dòng hoàn do lệnh này tạo

Business flow:
  1. Load đơn                                              → rejected_rental_not_found     (có sẵn)
  2. Đơn phải hủy được (booked | out-sổ-trống)              → rejected_cancel_not_allowed   (có sẵn, + currentStatus)
  3. Đơn `out` mà sổ có tiền                               → rejected_cancel_has_payments  (có sẵn — Q1: váy đang ở ngoài
                                                             thì lối ra là trả váy, không phải huỷ)
  --- dưới row lock của đơn, CÙNG transaction với status flip ---
  4. Sổ có tiền mà basis vắng hoặc ≠ số đã thu hiện tại    → rejected_cancel_basis_changed (MỚI, + collectedDeposit, collectedRentalFee)
     (client cũ không gửi basis ⇒ rơi vào đây khi sổ có tiền ⇒ màn hình mới mở dialog hoàn)
  5. hoàn > đã thu (từng khoản)                            → rejected_refund_exceeds_collected (MỚI, + kind, collected, submitted)
  6. hoàn < đã thu (giữ lại tiền) mà actor không phải owner → 403 forbidden (reason: cancel_retention_requires_owner)  (Q3)
     hoàn < đã thu mà note trống                            → rejected_retention_note_required (MỚI)                 (Q3)
  7. status → cancelled, items blocking=false (như cũ) + ghi 0..2 dòng hoàn (số > 0) — MỘT transaction
  Sổ trống ⇒ bước 4–6 bỏ qua, hành vi y hệt hôm nay.

Domain rules / invariants:
  - R1: huỷ có tiền chỉ từ `booked` (Q1).
  - R2: mỗi khoản hoàn ≤ khoản đã thu cùng loại (cọc ↔ hoàn cọc; tiền thuê ↔ hoàn tiền thuê).
  - R3: số hoàn tính trên số ĐÃ THU tại lúc ghi — basis kiểm dưới row lock (cùng pattern
        `saveReturned` / `DepositBasisChangedError`); record-collection khoá cùng row nên hai
        thao tác lần lượt, không chồng.
  - R4: không ghi dòng 0₫ (BR-4) — hoàn 0 = không có dòng.
  - R5: kind `rental_fee_refund` chỉ cancel sinh ra (một khoản tiền một nơi sinh — record-collection R1).
  - R6: sau khi huỷ, đơn đóng ⇒ record-collection từ chối ghi thêm (`rejected_rental_closed`, có sẵn).
```

### Outcome catalog (`POST /rentals/:id/cancel`)

| `status` | Meaning | HTTP | Payload | Mới? |
| --- | --- | --- | --- | --- |
| *(none)* | Đã huỷ (+ đã ghi hoàn) | 200 | `IdResponse` | — |
| `rejected_rental_not_found` | | 422 | — | có sẵn |
| `rejected_cancel_not_allowed` | returned/cancelled | 422 | `currentStatus` | có sẵn |
| `rejected_cancel_has_payments` | `out` + sổ có tiền | 422 | — | có sẵn, **thu hẹp nghĩa** (chỉ `out`) |
| `rejected_cancel_basis_changed` | Số đã thu khác số màn hình đã thấy (hoặc chưa gửi basis) | 422 | `collectedDeposit`, `collectedRentalFee` | **mới** |
| `rejected_refund_exceeds_collected` | Hoàn nhiều hơn đã thu | 422 | `kind`, `collected`, `submitted` | **mới** |
| `rejected_retention_note_required` | Giữ lại tiền mà không ghi lý do | 422 | — | **mới** (Q3) |
| `forbidden` | Staff giữ lại tiền | 403 | `reason: 'cancel_retention_requires_owner'` | **mới** (Q3, giống late-fee waiver) |

## 3. UI state matrix — dialog huỷ (3 chỗ: Bảng Hôm nay, `/rentals`, `/rentals/:id`)

| State | Condition | Display / action |
| --- | --- | --- |
| sổ trống | payments rỗng | confirm dialog như hôm nay ("Huỷ đơn của {{customer}}?") |
| **sổ có tiền** | `summary.deposit + summary.rentalFee > 0` | dialog **"Huỷ đơn & hoàn tiền"**: hai dòng "Đã thu cọc X / Đã thu tiền thuê Y"; ô **Hoàn cọc** pre-fill X; ô **Hoàn tiền thuê** pre-fill theo Q2; dòng tổng "Trả lại khách Z — tiệm giữ W"; ô Ghi chú (bắt buộc khi W > 0) |
| staff, W > 0 | role ≠ owner | nút Xác nhận disabled + message "Chỉ chủ tiệm được giữ lại tiền khi huỷ" |
| loading sổ / lỗi sổ | query payments | loading / banner đỏ + Thử lại, nút disabled (không đoán basis) |
| submitting | | disabled, chặn double submit |
| accepted | 200 | toast "Đã huỷ đơn, hoàn {{Z}}." ; refetch list/board/detail/payments |
| basis-changed | `rejected_cancel_basis_changed` | GIỮ dialog, cập nhật số đã thu từ payload, pre-fill lại, message "Sổ vừa thay đổi — kiểm tra lại số hoàn" |
| exceeds | `rejected_refund_exceeds_collected` | message dưới ô tương ứng |
| note-required / forbidden | | message dưới ô Ghi chú / trên nút |
| has-payments (`out`) | `rejected_cancel_has_payments` | toast hiện tại ("đơn đã giao có tiền — dùng Nhận về") |

Dialog "Tiền của lượt thuê" + chi tiết đơn: hiển thị kind mới "Hoàn tiền thuê" (vi/en) và tổng
`rentalFeeRefund` trong summary.

Prototype từng hàng (`docs/design/prototypes/rentals/cancel-with-refund/`): vòng duyệt thứ hai.

## 4. FE data needs

| Need | Source | Change |
| --- | --- | --- |
| Số đã thu để pre-fill + basis | `GET /rentals/:id/payments` `summary` | thêm `rentalFeeRefund` vào `PaymentSummaryDto`; `PaymentKind` thêm `rental_fee_refund` |
| Biết mình là owner | session `me.role` | có sẵn |
| Lệnh huỷ | `CancelRentalRequestDto` | **mới** (hôm nay cancel không có body) |

## 5. Traceability skeleton

| Item | Value |
| --- | --- |
| FR (đề xuất) | **FR-RENT-06 (sửa)**: Cancel `booked` — kể cả khi sổ có tiền, khi đó ghi dòng hoàn (`deposit_refund` / `rental_fee_refund`) cùng transaction, mỗi khoản hoàn ≤ đã thu; giữ lại tiền chỉ owner + ghi chú — hoặc `out` với sổ TRỐNG → `cancelled` |
| Feature id | `rentals/cancel-with-refund` (tier: design, designDoc: file này) |
| Invariants | `payments.kind` CHECK thêm `rental_fee_refund` (migration up/down + raw SQL proof kind lạ vẫn bị chặn). R2/R3 = kiểm dưới row lock trong transaction ghi (cùng mức với return flow hôm nay — **không có constraint DB cho "hoàn ≤ thu"**, xem contract check) |
| BE tests | unit từng outcome; e2e: huỷ booked có tiền OK + dòng hoàn; race cancel ↔ collect → basis_changed; out có tiền vẫn has_payments; staff giữ tiền → 403 |
| FE tests | dialog 2 dạng; pre-fill; owner/staff; basis-changed |
| ADR 0001 §3/§4 | thêm 3 code 422 + reason 403 mới |

## 6. Decisions (chủ tiệm chốt 2026-11-07 — chấp nhận cả 5 đề xuất bên dưới)

1. Huỷ có tiền **chỉ cho `booked`**; `out` có tiền vẫn phải Nhận về.
2. Ô hoàn tiền thuê **pre-fill hoàn đủ**.
3. Giữ lại tiền (cọc hoặc tiền thuê) **chỉ owner, bắt buộc ghi chú**.
4. Cọc **được** giữ lại theo cùng luật Q3.
5. **Không** có phí huỷ tự tính — người huỷ nhập số hoàn.

| # | Câu hỏi | Agent đề xuất | Vì sao | Nếu chọn khác |
| --- | --- | --- | --- | --- |
| 1 | Đơn **đã giao** (`out`) mà sổ có tiền: vẫn chỉ được "Nhận về" (không huỷ)? | **Giữ như hôm nay** — huỷ có tiền chỉ cho `booked` | Váy đang ở ngoài; huỷ sẽ giải phóng lịch khi váy chưa về | mở cho `out` → phải xử lý váy chưa về |
| 2 | Pre-fill ô **hoàn tiền thuê**: hoàn đủ hay 0? | **Hoàn đủ** (= đã thu) — người huỷ chủ động sửa xuống | Số mặc định không âm thầm giữ tiền khách; giữ tiền là quyết định có ghi chú | pre-fill 0 (giữ hết tiền thuê làm phí huỷ) |
| 3 | Ai được **giữ lại** tiền (hoàn < đã thu)? | **Chỉ owner, bắt buộc ghi chú** — giống miễn/giảm phí trễ | Tiền khách đã đưa, giữ lại là quyết định tiền bạc | mọi nhân viên (chỉ bắt ghi chú) |
| 4 | Cọc có được giữ lại (không hoàn đủ cọc) khi huỷ? | **Được** — cùng luật Q3 (owner + ghi chú) | Một luật cho cả hai khoản, đơn giản | cọc luôn hoàn đủ (ô hoàn cọc khoá) |
| 5 | Có phí huỷ cố định/theo % (tự tính như phí trễ) không? | **Không** — người huỷ nhập số hoàn | Chưa có chính sách phí huỷ trong SRS | thêm env + quote như `late-fee` |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Suggested fix |
| --- | --- | --- |
| major | "hoàn ≤ đã thu" là luật cross-row, không biểu diễn bằng CHECK/UNIQUE — chỉ được giữ bằng row lock + kiểm trong transaction (giống refund trong return flow hôm nay) | chấp nhận ở mức hiện có của repo; nếu muốn có răng ở DB: constraint trigger trên `payments` (Σ refund ≤ Σ collected theo đơn) — đề xuất làm sau, cho CẢ return lẫn cancel |
| major | `PaymentKind` / `PaymentSummaryDto` đổi ⇒ contract đổi cho cả 3 client; mọi switch trên kind ở FE phải có nhánh mới (TS exhaustive) | `pnpm contract`, i18n vi/en cùng commit |
| major | Cancel có body ⇒ ba nơi gọi `cancelRental.mutate({ id })` phải đổi; client cũ (không basis) + sổ có tiền ⇒ `basis_changed` thay vì `has_payments` | FE map `basis_changed` → mở dialog hoàn |
| minor | `rejected_cancel_has_payments` thu hẹp nghĩa (chỉ `out`) — message FE hiện nói chung chung | đổi copy: "Đơn đã giao có tiền — dùng Nhận về" |
| minor | `PaymentRecorderPort.SettlementPaymentKind` thêm `rental_fee_refund` | một dòng type |

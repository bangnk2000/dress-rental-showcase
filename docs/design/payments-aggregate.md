# payments — Tactical Design

> Status: **as-built 2026-08-10** · SRS: FR-PAY-01, FR-PAY-02, BR-4, BR-6, BR-7 · Context Supporting

## Vai trò & ranh giới

Sở hữu bảng `payments` — các dòng tiền của một đơn thuê — cùng read surface
(`GET /rentals/:rentalId/payments`, kèm `summary` cộng sẵn theo kind) và **aggregate + command đầu
tiên**: ghi nhận tiền ĐÃ THU (`POST /rentals/:rentalId/payments/collect`, FR-PAY-02).

Ranh giới hiện tại chia theo *ai sinh ra khoản tiền*:

| Nhóm kind | Ai ghi | Vì sao |
| --- | --- | --- |
| `deposit`, `rental_fee` (tiền VÀO) | **payments** — `record-collection` | Thu tiền là nghiệp vụ đứng riêng: khách đưa cọc lúc đặt, lúc lấy váy, hay chuyển khoản trước đều được (chủ tiệm chốt 2026-08-10) |
| `deposit_refund`, `late_fee`, `damage_fee` (tất toán) | **rentals** — return flow qua `PaymentRecorderPort` | Tất toán là một BƯỚC của việc trả váy, không phải use case độc lập |
| `deposit_refund`, `rental_fee_refund` (hoàn khi huỷ, 2026-11-07) | **rentals** — cancel flow, ghi trong transaction của `saveCancelled` | Huỷ đơn `booked` đã trả trước là một BƯỚC của việc huỷ ([rentals/cancel-with-refund.md](./rentals/cancel-with-refund.md)); `rental_fee_refund` chỉ cancel sinh ra |

Đây đúng là kịch bản đã dự trù từ lần thiết kế đầu ("khi có nghiệp vụ tiền độc lập thì aggregate +
command mọc ở ĐÂY, không phình vào rentals") — và nó đã xảy ra.

## Aggregate

`PaymentEntity` = MỘT dòng tiền (`rentalId`, `kind`, `amount: Money`, `note`). Không có method nào
đổi số tiền: sổ chỉ ghi thêm (append-only theo nghiệp vụ). `validate()` chặn số 0 — "không thu" là
**vắng dòng**, không phải dòng 0₫. Event `PaymentRecordedDomainEvent` (chưa có consumer).

## Persistence sketch

`payments` (id, rental_id FK → rentals, kind CHECK ∈ {`deposit`, `deposit_refund`, `rental_fee`,
`rental_fee_refund` (migration `1755800000000`), `late_fee`, `damage_fee`}, amount integer CHECK ≥ 0, note, created_at). Không có `updated_at`: dòng
tiền viết một lần. Hai partial UNIQUE index (migration `1754900000000`) giữ BR-7.

## Bảng invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| BR-4: amount VND integer ≥ 0 | `Money` VO + `PaymentEntity.validate()` (≥ 1) + `@Min(1)` trên request DTO | `CHECK (amount >= 0)` | 400 envelope | `payment.entity.spec.ts`; e2e "0₫ là 400 envelope" |
| BR-7: mỗi đơn ≤ 1 dòng `deposit` | pre-check `findCollected()` trong `record-collection.service.ts` | `UNIQUE INDEX payments_one_deposit_per_rental … WHERE kind='deposit'` | 422 outcome `rejected_deposit_already_recorded` (+ `recordedAmount`) | `payments-collection.e2e-spec.ts`: hai request đồng thời → [200, 422] và ĐÚNG 1 dòng; raw INSERT bị index từ chối |
| BR-7: mỗi đơn ≤ 1 dòng `rental_fee` | như trên | `UNIQUE INDEX payments_one_rental_fee_per_rental` | 422 `rejected_rental_fee_already_recorded` | như trên |
| Chỉ ghi tiền khi đơn còn mở (booked\|out) | `RentalLookupPort.findStatus()` (pre-check) **và** đọc lại `SELECT status … FOR UPDATE` NGAY TRONG transaction ghi | Row lock trên `rentals` — pre-check một mình là TOCTOU: một lượt return commit xen vào giữa vẫn cho tiền rơi vào đơn đã đóng | 422 `rejected_rental_closed` + `currentStatus` | unit (cả hai nguồn) + e2e: giữ một transaction `UPDATE … status='returned'` chưa commit rồi bắn lệnh thu — request phải CHỜ lock, rồi bị từ chối, sổ 0 dòng |
| Kind hợp lệ | TypeScript union (`CollectionKind` cho lệnh thu, `SettlementPayment['kind']` cho tất toán) | `CHECK (kind IN (...))` | — | — |
| Movement thuộc đơn có thật | `findStatus()` trả null → outcome | `REFERENCES rentals (id)` | 422 outcome (write) / 404 envelope (read) | e2e |
| BR-6: settlement ghi SAU flip status returned; ghi lỗi → nhập tay lại | Thứ tự trong `return-rental.service.ts` (comment giải thích trade-off) | (không có — chấp nhận MVP) | — | — (theo dõi: nếu tái diễn thực tế → chuyển sang cùng transaction, thành feature design-tier) |

Race của BR-7 đi đúng đường của `rental_items_no_overlap`: repository dịch
`UniqueIntegrityConstraintViolationError` → `CollectionConflictError` (port-level, không rò slonik),
service đọc lại sổ và trả **cùng outcome** với pre-check, kèm số tiền bên thắng vừa ghi (ADR 0001 §2).

## Cross-context

| Kênh | Chi tiết | Trạng thái |
| --- | --- | --- |
| Bị rentals GHI qua `payment-recorder.adapter.ts` | rentals ghi thẳng bảng `payments` khi return | **Deviation #4** |
| `RentalLookupPort` ← `rental-lookup.adapter.ts` | payments ĐỌC bảng `rentals` để lấy trạng thái (`findStatus`) cho cả read slice lẫn lệnh thu | Deviation #4 |

Payments **không** import code của rentals: union trạng thái được khai báo lại tại chỗ
(`RentalStatusSnapshot`), giống cách rentals tự khai báo `DressSnapshot`.

## Projection

- `payment.projection.ts` — `toPaymentDto` (một dòng) + `toPaymentSummaryDto` (tổng theo kind), hàm
  thuần, có `.spec.ts`. `summary` do BE cộng để dialog trả váy và dialog tiền đọc CÙNG một con số
  thay vì mỗi màn hình tự cộng.

## Open questions

- **Sửa dòng đã ghi sai** (`payments/correct-movement`): sổ append-only mà `amount ≥ 0` nên không
  ghi bù âm được; hiện outcome chỉ nói "đã ghi X" để nhân viên biết sổ đang có gì. Cần chủ tiệm
  quyết ai được sửa và lưu vết ra sao → FR riêng.
- **Thu cọc/tiền thuê làm nhiều lần**: BR-7 cho tối đa một dòng mỗi loại. Nếu tiệm cho trả góp cọc
  thì rule + index + outcome phải đổi CÙNG LÚC.
- Tổng hợp doanh thu/báo cáo sẽ là read slice mới ở đây — standard-tier nếu chỉ SELECT aggregate,
  design-tier nếu thêm khái niệm kỳ đối soát. `summary` hiện tại là mức đơn, không phải mức kỳ.
- ~~Tiền cọc THU vào không được ghi ở đâu cả~~ → đóng bởi FR-PAY-02
  ([record-collection.md](./payments/record-collection.md)).
- ~~Phí có được trừ thẳng vào cọc không?~~ → **có**, chủ tiệm duyệt 2026-08-10 (§6.Q3 của spec).
  Hoàn cọc = **cọc đã thu** − phí; `RentalDressDto.depositAmount` chỉ còn là số tham chiếu khi đơn
  chưa ghi nhận cọc, và màn hình phải nói rõ điều đó.

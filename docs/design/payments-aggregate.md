# payments — Tactical Design

> Status: **as-built 2026-08-02** · SRS: FR-PAY-01, BR-4, BR-6 · Context Supporting

## Vai trò & ranh giới

Sở hữu bảng `payments` — các dòng tiền của một đơn thuê — và read surface đầu tiên
(`GET /rentals/:rentalId/payments`). **Chưa có aggregate/command nào**: write side nằm có chủ
ý trong return flow của rentals (qua `PaymentRecorderPort`), vì "settle khi trả váy" là một
bước của nghiệp vụ trả, không phải use case độc lập. Context này tồn tại để giữ chỗ ranh giới:
khi có nghiệp vụ tiền độc lập (thu cọc trước, refund lẻ, đối soát) thì aggregate + command
mọc ở ĐÂY, không phình vào rentals.

## Persistence sketch

`payments` (id, rental_id FK → rentals, kind CHECK ∈ {`deposit_refund`, `late_fee`,
`damage_fee`}, amount integer CHECK ≥ 0, note, created_at). Chỉ ghi thêm (append-only theo
nghiệp vụ hiện tại — không update/delete movement; sai thì ghi movement bù, quy ước vận hành).

## Bảng invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| BR-4: amount VND integer ≥ 0 | filter movements > 0 trong `return-rental.service.ts` | `CHECK (amount >= 0)` | 400 | GAP #5 |
| Kind hợp lệ | TypeScript union `SettlementPayment['kind']` | `CHECK (kind IN (...))` | — | — |
| Movement thuộc đơn có thật | — | `REFERENCES rentals (id)` | 404/409 | — |
| BR-6: settlement ghi SAU flip status returned; ghi lỗi → nhập tay lại | Thứ tự trong `return-rental.service.ts` (comment giải thích trade-off) | (không có — chấp nhận MVP) | — | — (theo dõi: nếu tái diễn thực tế → chuyển sang cùng transaction, thành feature design-tier) |

## Cross-context

| Kênh | Chi tiết | Trạng thái |
| --- | --- | --- |
| Bị rentals GHI qua `payment-recorder.adapter.ts` | rentals ghi thẳng bảng `payments` khi return | **Deviation #4** |
| `RentalLookupPort` ← `rental-lookup.adapter.ts` | payments ĐỌC bảng `rentals` để validate rentalId cho read slice | Deviation #4 |

## Projection

`payment.projection.ts` — hàm thuần format movements cho response, có `.spec.ts` (pattern
projection-tách-khỏi-SQL của repo).

## Open questions

- Tổng hợp doanh thu/báo cáo (candidate session-handoff) sẽ là read slice mới ở đây —
  standard-tier nếu chỉ SELECT aggregate, design-tier nếu thêm khái niệm kỳ đối soát.

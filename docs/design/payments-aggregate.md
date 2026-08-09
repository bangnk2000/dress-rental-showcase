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
| BR-4: amount VND integer ≥ 0 | filter movements > 0 trong `return-rental.service.ts` | `CHECK (amount >= 0)` | 400 envelope | chưa có test khiêu khích riêng — bổ sung vào `apps/be/test/` khi payments có write endpoint (hiện chỉ ghi qua return flow) |
| Kind hợp lệ | TypeScript union `SettlementPayment['kind']` | `CHECK (kind IN (...))` | — | — |
| Movement thuộc đơn có thật | — | `REFERENCES rentals (id)` | không thể xảy ra qua API (chỉ ghi trong return flow của một rental đã load); vi phạm = 500 envelope nếu bypass | — |
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
- **Tiền cọc THU vào không được ghi ở đâu cả.** `payments` chỉ có các dòng lúc tất toán, nên một
  `deposit_refund` không có dòng `deposit` đối ứng — tiệm không đối soát được tiền mặt từ màn hình
  này. Đây là gap chức năng lớn nhất còn lại (readiness r1 nêu ở ba feature khác nhau).
- **Cần chủ tiệm xác nhận: phí có được trừ thẳng vào cọc không?** `rentals/settlement-clarity`
  (2026-08-10) pre-fill ô "Hoàn cọc" bằng `tổng cọc chuẩn − phí trễ đề xuất`, tức là ĐANG giả định
  tiệm trừ phí vào cọc rồi hoàn phần còn lại. Bằng chứng cho giả định đó là `smoke.sh` (phí 200.000
  + hoàn 2.800.000 trên cọc 3.000.000) và happy path Playwright — **không phải** một quyết định
  nghiệp vụ được duyệt bằng văn bản như quy tắc phí trễ ở
  [rentals/settle-late-fee.md §6](./rentals/settle-late-fee.md). Ô này sửa được và phép tính hiện
  trên màn hình, nên nếu tiệm thu phí riêng bằng tiền mặt thì chỉ tốn một lần sửa; vẫn nên hỏi.
- `RentalDressDto.depositAmount` là **cọc chuẩn trong danh mục**, không phải số đã thu. Mọi chỗ
  hiển thị nó phải nói rõ là số tham chiếu — chừng nào câu hỏi đầu tiên ở trên chưa được đóng.

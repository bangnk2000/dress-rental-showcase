# Thu cọc khi tạo đơn & nhắc cọc khi giao váy — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `rentals` (Core) — chủ của create + pickup; ghi vào sổ `payments` bằng domain code của record-collection (xem amendment R1 ở §6) |
| Status | **as-built 2026-11-07** (§7) — approved 2026-11-07 (§6 Q1–Q6, Q8). Chủ tiệm **chọn bỏ vòng prototype** ("code luôn đi") — §3 state matrix là bản thiết kế UI. Phụ thuộc `rentals/cancel-with-refund` đã merge (PR #38) |
| AC source | Yêu cầu chủ tiệm 2026-11-07: *"khi tạo đơn có 1 checkbox để tick xem khách hàng đã trả cả tiền cọc hay chỉ mới trả tiền thuê; nếu chưa trả tiền cọc thì có warning ở màn giao váy và hiện thêm 1 modal confirm để nhân viên xác nhận là đã thu đủ tiền cọc khi giao váy"* |
| FR | **FR-RENT-14 (đề xuất, §5)** — vào SRS cùng PR code, sau khi §6 được duyệt |
| Rules approved by | Chủ tiệm — 2026-11-07 (§6) |

> Vì sao design-tier: contract cross-context MỚI (create + pickup của rentals ghi dòng `deposit` /
> `rental_fee` vào sổ payments — trước nay chỉ return flow làm vậy), và pattern tương tác FE mới
> (cảnh báo + modal xác nhận chen vào thao tác giao váy).

### Nguyên tắc nền: "đã đóng cọc" là SỐ TRONG SỔ, không phải cờ trên đơn

Sổ `payments` đã trả lời được câu "khách đã đóng cọc chưa": `summary.deposit > 0`
([record-collection](../payments/record-collection.md) R3/R7). Spec này **không thêm cột/cờ
`deposit_paid`** trên `rentals`:

- cờ riêng sẽ lệch với sổ (tick "đã cọc" nhưng sổ trống → dialog trả váy vẫn báo "chưa ghi nhận cọc"
  và hoàn theo cọc chuẩn — đúng cái R7 chặn);
- checkbox lúc tạo và modal lúc giao **đều ghi dòng `deposit` thật** vào sổ, với số tiền thực thu.
  Cảnh báo ở màn giao váy = "sổ chưa có dòng cọc".

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Đã đóng cọc | Đơn có dòng `payments.kind = 'deposit'` (`summary.deposit > 0`) | đã có — không thêm khái niệm mới |
| Thu khi tạo đơn | Các khoản (tiền thuê, và cọc nếu tick) ghi vào sổ CÙNG transaction tạo đơn | mới |
| Thu cọc khi giao | Dòng `deposit` ghi CÙNG transaction chuyển `booked → out` | mới |
| Cảnh báo cọc | Banner/nhãn "Chưa thu cọc" trên một đơn sắp giao mà sổ chưa có dòng cọc | mới, chỉ là hiển thị |

## 2. Use-case specification

### 2a. CreateRental — thêm khối `collect` (tuỳ chọn)

```text
Business input (thêm):
  - collect?: {
      rentalFee?: VND integer ≥ 1   // tiền thuê khách đã trả lúc đặt (Q1)
      deposit?:   VND integer ≥ 1   // CÓ khi checkbox "Khách đã đóng cọc" được tick
    }
  VẮNG `collect` = hành vi hiện tại (không ghi sổ) — client cũ không đổi.

Business flow (thêm vào cuối flow hiện có, CÙNG transaction):
  … tạo đơn + items như cũ (BR-1 / rejected_dress_unavailable giữ nguyên)
  n. collect có khoản > 0 → PaymentRecorderPort ghi 1..2 dòng (deposit / rental_fee)
  Đơn vừa tạo chưa thể có dòng nào ⇒ KHÔNG có outcome mới; UNIQUE (R3 của record-collection)
  vẫn là lưới an toàn ở DB.
  Lỗi ghi sổ ⇒ rollback cả đơn (không có "tạo được đơn, mất tiền").
```

### 2b. PickupRental — thêm `depositCollected` (tuỳ chọn)

```text
Business input (thêm):
  - depositCollected?: VND integer ≥ 1 — số cọc nhân viên vừa thu tại quầy (modal xác nhận)

Business flow:
  1. Load đơn                                      → rejected_rental_not_found          (có sẵn)
  2. Đơn phải booked                               → rejected_pickup_not_allowed        (có sẵn)
  3. depositCollected có mặt và sổ ĐÃ có dòng cọc  → rejected_deposit_already_recorded  (TÁI DÙNG
                                                     code của record-collection, + recordedAmount)
  4. depositCollected vắng và sổ chưa có cọc       → rejected_deposit_not_collected     (MỚI, Q3)
     (đọc sổ dưới row lock của đơn — một collect chen vào giữa vẫn được thấy)
  5. markPickedUp + (nếu có) ghi dòng deposit — MỘT transaction
  6. Race thua UNIQUE index ở bước 5 → truy vấn lại, trả ĐÚNG outcome bước 3 (giống record-collection)
```

Bước 3 từ chối cả lệnh (KHÔNG giao váy) thay vì "giao luôn, bỏ qua cọc": người khác vừa ghi một số
cọc khác với số nhân viên này đang cầm — màn hình phải cho thấy số đã ghi để nhân viên giao lại
(lần này không kèm cọc). Một luật = một code: dùng lại `rejected_deposit_already_recorded`.

### Outcome catalog

| Endpoint | `status` | Meaning | HTTP | Payload | Mới? |
| --- | --- | --- | --- | --- | --- |
| `POST /rentals` | *(không đổi)* | — | — | — | không có outcome mới |
| `POST /rentals/:id/pickup` | *(none)* | Đã giao (+ đã ghi cọc nếu có) | 200 | `IdResponse` | — |
| | `rejected_rental_not_found` | | 422 | — | có sẵn |
| | `rejected_pickup_not_allowed` | | 422 | `currentStatus` | có sẵn |
| | `rejected_deposit_already_recorded` | Gửi kèm cọc nhưng sổ đã có dòng cọc | 422 | `recordedAmount` | **mới trên endpoint này** (code có sẵn) |
| | `rejected_deposit_not_collected` | Giao mà sổ chưa có cọc và lệnh không kèm cọc | 422 | — | **mới** (Q3) |

Ghi chú: đây là luật ở BE (không chỉ FE) — client cũ gọi pickup không body sẽ bị từ chối khi sổ
chưa có cọc. FE và BE ship cùng một đơn vị (invariant #5), nhưng FE là PWA: bản cũ có thể còn trên
máy tính bảng của tiệm tới khi bấm "Tải lại". **Sửa as-built:** bản cũ map mọi outcome lạ thành
"Lượt thuê này không còn tồn tại" (không phải toast chung) — sai thông điệp nhưng không ghi gì. Vì
vậy bước deploy gồm: **tải lại CMS trên mọi máy của tiệm** (chấp nhận "Đã có phiên bản mới") trước
lượt giao váy đầu tiên. Cùng lưu ý áp cho huỷ đơn trả trước (PR #38).

## 3. UI state matrix

### Form tạo đơn `/rentals/new`

| State | Condition | Display / action |
| --- | --- | --- |
| idle | — | Khối "Thanh toán lúc đặt": ô **Tiền thuê đã thu** pre-fill Σ giá − giảm giá (Q1); checkbox **"Khách đã đóng cọc"** (mặc định KHÔNG tick, Q2) |
| tick cọc | checkbox on | hiện ô **Tiền cọc** pre-fill Σ cọc chuẩn của váy đã chọn, sửa được (Q4) |
| đổi váy/giảm giá | items/discount đổi | pre-fill tính lại CHỈ khi nhân viên chưa tự sửa ô đó |
| giao ngay (sinh `out`) | startDate ≤ hôm nay & không tick cọc | cảnh báo vàng ngay trên nút Lưu: "Đơn này giao ngay — chưa thu cọc" (Q5) |
| accepted / rejections | như hiện tại | không đổi; sổ ghi cùng lúc nên trang chi tiết hiện ngay các dòng tiền |

### Giao váy — Bảng Hôm nay (nút Giao ở CẢ ba mục: `dueOut`, và đơn `booked` nằm ở `dueBack` / `overdue` — FR-RENT-10c giao trễ; `today-route.tsx`)

`/rentals/:id` KHÔNG có nút giao (giao và nhận về chỉ ở bảng Hôm nay — `rental-detail-route.tsx`), nên
không thuộc phạm vi (sửa 2026-11-07 khi bắt đầu code).

| State | Condition | Display / action |
| --- | --- | --- |
| đã cọc | `depositCollected > 0` | như hiện tại; nhãn nhỏ "Đã cọc {{amount}}" |
| **chưa cọc** | `depositCollected = 0` | nhãn/banner vàng **"Chưa thu cọc"** trên thẻ đơn |
| bấm Giao (đã cọc) | | giao luôn như hiện tại |
| bấm Giao (chưa cọc) | | **Modal "Xác nhận thu cọc"**: ô Tiền cọc pre-fill Σ cọc chuẩn (sửa được, ≥ 1, Q4) + nút **"Đã thu cọc & giao váy"** + nút Đóng. KHÔNG có nút giao mà bỏ qua cọc (Q3) |
| submitting | | nút disabled, chặn double submit |
| accepted | 200 | toast "Đã giao váy và ghi nhận cọc." / "Đã giao váy."; refetch board + payments |
| deposit-already | `rejected_deposit_already_recorded` | GIỮ modal, message "Đơn đã ghi cọc {{recordedAmount}} — giao lại không kèm cọc"; refetch; nút đổi thành "Giao váy" |
| not-collected | `rejected_deposit_not_collected` (board cũ nghĩ đã cọc, nhưng sổ không có) | refetch board + MỞ modal thu cọc cho đơn đó |
| pickup-not-allowed / not-found | có sẵn | hành vi hiện tại (toast + refetch) |
| network-error | | toast + bấm lại (an toàn: lần 2 bị UNIQUE / state guard chặn) |

Prototype: chủ tiệm chọn bỏ (2026-11-07).

## 4. FE data needs

| Need | Source | Change |
| --- | --- | --- |
| Board biết đơn nào chưa cọc | `GET /rentals/today-board` | **thêm `depositCollected: number`** (Σ dòng deposit, 0 = chưa) vào `TodayBoardRentalDto` — một subquery trong projection, KHÔNG gọi payments theo từng thẻ |
| Pre-fill cọc trong modal | Σ `depositAmount` của váy | không đổi — `TodayBoardRentalDto.dresses[].depositAmount` đã có (bỏ `standardDeposit` dự tính ban đầu) |
| Chi tiết đơn | `GET /rentals/:id/payments` (`summary.deposit`) | không đổi |
| Tạo đơn | `CreateRentalRequestDto.collect` | mới |
| Giao váy | `PickupRentalRequestDto.depositCollected` (body mới; hiện pickup không có body) | mới |

Contract: BE → `pnpm contract` → cả 3 client (web/qr-admin không dùng, chỉ regenerate).

## 5. Traceability skeleton

| Item | Value |
| --- | --- |
| FR (đề xuất) | **FR-RENT-14** Thu tiền lúc đặt & nhắc cọc lúc giao: form tạo đơn ghi nhận tiền thuê (và cọc nếu khách đã đóng) vào sổ cùng lúc tạo; đơn sắp giao mà sổ chưa có cọc bị đánh dấu "Chưa thu cọc"; giao váy chưa cọc phải qua modal xác nhận thu cọc, ghi dòng cọc cùng transaction với pickup |
| Feature id | `rentals/deposit-at-pickup` (tier: design, designDoc: file này) |
| Invariants | không thêm constraint mới — tái dùng partial UNIQUE (1 dòng deposit / 1 dòng rental_fee mỗi đơn) và state guard pickup; proof e2e mới: create+collect rollback khi đơn trùng lịch; pickup+deposit race với collect; raw SQL vẫn bị UNIQUE chặn |
| BE tests | create với/không `collect`; pickup với `depositCollected` (ok / already-recorded / race); pickup không cọc khi sổ trống → rejected_deposit_not_collected (cả race với collect) |
| FE tests | checkbox + pre-fill; banner board (cả 3 mục); modal: ok, already-recorded, not-collected |
| ADR 0001 §3/§4 | thêm hàng `rejected_deposit_already_recorded` cho pickup + rejected_deposit_not_collected |

## 6. Decisions (chủ tiệm chốt 2026-11-07)

| # | Quyết định |
| --- | --- |
| 1 | Tiền thuê lúc tạo: **tuỳ chọn**, pre-fill Σ giá − giảm giá; xoá trắng = chưa thu |
| 2 | Checkbox "Khách đã đóng cọc": **không tick sẵn** |
| 3 | Giao váy khi sổ chưa có cọc: **chặn cứng** → `rejected_deposit_not_collected`; modal chỉ có "Đã thu cọc & giao váy" |
| 4 | Số cọc **sửa được**, ghi số thực thu (≥ 1), một dòng cọc duy nhất — thu thiếu vẫn tính "đã cọc" |
| 5 | Đơn sinh `out` lúc tạo: **cảnh báo vàng trên form**, vẫn cho lưu không cọc |
| 6 | Áp cho **mọi đơn**, kể cả đơn tạo trước tính năng |
| 7 | Không còn áp dụng (Q3 bỏ nút giao-không-cọc) |
| 8 | Huỷ đơn đã trả trước: **huỷ kèm ghi tiền hoàn**, tách thành feature riêng `rentals/cancel-with-refund` (kind mới hoàn tiền thuê + migration), spec riêng, **ship trước** feature này |

Ghi nhận: Q3 (chặn cứng) + Q5 (giao ngay được lưu không cọc) nghĩa là đơn tạo hôm nay có thể ra
khỏi tiệm không cọc, đơn đặt trước thì không. Chủ tiệm chọn vậy có chủ đích.

### Câu hỏi đã hỏi (giữ để truy vết)

| # | Câu hỏi | Agent đề xuất | Vì sao | Nếu chọn khác |
| --- | --- | --- | --- | --- |
| 1 | Lúc tạo đơn, khách **luôn** trả tiền thuê? Ô tiền thuê bắt buộc hay để trống được (đặt giữ chỗ chưa trả gì)? | Ô tiền thuê **tuỳ chọn**, pre-fill Σ giá − giảm giá; xoá trắng = chưa thu | Có ca khách giữ chỗ qua điện thoại | bắt buộc → thêm validation, đơn không thể tạo khi chưa thu |
| 2 | Checkbox "Khách đã đóng cọc" mặc định tick hay không? | **Không tick** | Tick nhầm = sổ ghi khoản tiền chưa nhận — sai lệch tiền nguy hiểm hơn thiếu cảnh báo | mặc định tick |
| 3 | Khi giao váy chưa cọc: chỉ **cảnh báo** (nhân viên vẫn giao được, vd khách quen giữ CCCD) hay **chặn cứng**? | **Cảnh báo + modal**, modal có nút phụ "Giao, chưa thu cọc" | Đúng mô tả "warning"; chặn cứng cần outcome mới ở BE | chặn cứng → `rejected_deposit_not_collected` + bỏ nút phụ |
| 4 | Số cọc thu (khi tạo / trong modal) có sửa được, hay luôn = Σ cọc chuẩn? Thu **một phần** cọc có hợp lệ? | **Sửa được**, một dòng duy nhất | Sổ ghi thực thu (FR-PAY-02); sổ chỉ cho MỘT dòng cọc nên không có "cọc lần 2" | cố định = cọc chuẩn; hoặc cho nhiều lần cọc → đổi R3 (migration) |
| 5 | Đơn tạo với ngày nhận ≤ hôm nay sinh ra ở `out` (FR-RENT-10b) — không qua màn giao. Nhắc cọc ở đâu? | **Cảnh báo ngay trên form tạo** khi không tick cọc | Đây chính là lúc giao | bắt tick/nhập cọc mới cho lưu (chặn cứng ở form) |
| 6 | Đơn đang mở hiện có (tạo trước tính năng, sổ trống) cũng hiện "Chưa thu cọc"? | **Có** — sổ không có cọc thì đúng là chưa ghi nhận | Một luật, không đoán theo ngày tạo | ẩn cảnh báo cho đơn tạo trước ngày release |
| 7 | Nhân viên thường hay chỉ chủ tiệm được bấm "Giao, chưa thu cọc"? | **Mọi nhân viên** (như pickup hiện tại) | Nhân viên đứng quầy | owner-only → guard mới `rental:pickup-without-deposit` |
| 8 | **Khách huỷ đơn đã trả trước** (tiền thuê/cọc ghi lúc tạo). Hiện tại huỷ bị chặn khi sổ có tiền (`rejected_cancel_has_payments`, guard áp cho cả `booked` — `cancel-rental.service.ts`), và trả váy chỉ đi từ `out` ⇒ đơn `booked` trả trước **không có lối ra**. Tính năng này biến ca đó thành ca thường. Tiền xử lý thế nào? | **Huỷ được, kèm dòng hoàn**: dialog huỷ hỏi số hoàn cho khách (cọc hoàn đủ; tiền thuê hoàn tuỳ — giữ lại = tiền mất cọc/phí huỷ), ghi `deposit_refund` / kind hoàn tiền thuê, rồi `cancelled` | Sổ phải khớp tiền thực trong két; không có "đơn treo" | (a) không cho huỷ đơn đã trả trước — phải liên hệ chủ tiệm sửa DB; (b) huỷ không ghi hoàn — sổ nói tiệm giữ tiền mãi. Đây là use case riêng (`rentals/cancel-with-refund`), có thể tách entry |

> **Sửa luật đã duyệt:** [record-collection](../payments/record-collection.md) R1 (duyệt
> 2026-08-10) nói mỗi khoản tiền chỉ có MỘT nơi sinh ra. Spec này thêm create + pickup làm nơi sinh
> `deposit` / `rental_fee`. Cách giữ tinh thần R1: create/pickup **không tự ghi** mà gọi đúng domain
> code của `payments/commands/record-collection` (R2 số ≥ 1, R3 UNIQUE, requery khi race) trong cùng
> transaction — qua một port mới phía rentals, adapter uỷ cho service payments. Không nhân bản luật
> sang `PaymentRecorderPort` (comment "payments has no domain code yet" của port đó đã cũ). Khi
> duyệt spec này, R1 được ghi amendment ở cả hai doc.

## Contract check (02-contract-check.md) — sẽ chạy lại sau §6

| Severity | Finding | Suggested fix |
| --- | --- | --- |
| major | `PaymentRecorderPort` chỉ nhận kind tất toán | port mới `CollectionRecorderPort` phía rentals; adapter uỷ cho domain code record-collection, dùng chung transaction (xem amendment R1 ở §6) |
| major | Huỷ đơn `booked` có tiền là ngõ cụt (Q8) | chốt Q8 trước khi code create+collect |
| major | Pickup hiện không có body — thêm body tuỳ chọn phải giữ client cũ (gửi rỗng) hợp lệ | DTO toàn field optional |
| minor | `rejected_deposit_already_recorded` xuất hiện trên endpoint thứ hai — giữ đúng payload `recordedAmount` để FE dùng chung message | dùng lại outcome DTO của payments |

## 7. Re-sync as-built (2026-11-07)

Khớp §2–§6, trừ các điểm sau:

| Điểm | As-built | Vì sao |
| --- | --- | --- |
| Nơi ghi tiền (amendment R1 ở §6) | Không qua port uỷ cho domain code record-collection: `RentalRepository` ghi dòng `payments` TRONG transaction của chính nó — `insertWithCollection` (bước `afterWrite`, SAU dòng rental vì `payments.rental_id` là FK) và `savePickedUp(entity, depositCollected)` (dưới row lock) | Cùng cách `rentals/cancel-with-refund` đã ship (Codex duyệt, PR #38): một transaction cho trạng thái + tiền. R2 (số ≥ 1) giữ ở DTO `@Min(1)`; R3 giữ bởi partial UNIQUE + đọc sổ dưới cùng row lock mà record-collection khoá. Vẫn là adapter chạm bảng của context khác (apps/be Deviation #4) |
| Bước 6 "race thua UNIQUE" của pickup | Không cần requery: pickup và record-collection cùng `SELECT … FOR UPDATE` dòng rental nên chạy lần lượt; pre-check dưới lock trả đúng `rejected_deposit_already_recorded` | e2e "race: a pickup collecting the deposit vs. a collection" chứng minh đúng MỘT dòng cọc |
| Ghi chú dòng tiền | `note` = NULL cho tiền thu lúc tạo và lúc giao | Form không có ô ghi chú tiền; ghi chú đơn (`notes`) là của đơn, không phải của dòng tiền |
| `/rentals/:id` | Không có nút giao — ngoài phạm vi (§3) | Giao/nhận về chỉ ở bảng Hôm nay |
| `standardDeposit` trên board | Bỏ — `dresses[].depositAmount` đã có | Tránh field thừa trên contract |
| Thẻ đơn `booked` | "Chưa thu cọc" (badge vàng) / "Đã cọc {{amount}}"; đơn `out` không hiện gì | Chỉ đơn còn phải giao mới cần câu hỏi cọc |
| Fixture/Playwright | Happy path thu cọc + tiền thuê NGAY lúc tạo (thay bước "Tiền" riêng) | Form điền sẵn tiền thuê (Q1), nên luồng thật của tiệm là ghi lúc đặt |

Bằng chứng: ledger `rentals/deposit-at-pickup`.

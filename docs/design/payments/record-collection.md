# Ghi nhận tiền đã thu (cọc + tiền thuê) — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `payments` (Supporting) — **command đầu tiên** của context này |
| Status | **approved 2026-08-10** (quyết định §6) → as-built §7 |
| AC source | Open question trong [payments-aggregate.md](../payments-aggregate.md): *"Tiền cọc THU vào không được ghi ở đâu cả"* + *"Cần chủ tiệm xác nhận: phí có được trừ thẳng vào cọc không?"*. FR: **FR-PAY-02** |
| Rules approved by | Chủ tiệm — 2026-08-10 (4 quyết định ở §6) |
| Contract approved by | Chủ tiệm (đại diện cả hai phía; BE + FE cùng repo, cùng commit) — 2026-08-10 |

> Vì sao là design-tier: `payments` mọc **aggregate + command đầu tiên** (trước nay chỉ có read
> slice, write side nằm nhờ trong return flow của rentals); thêm **invariant mới có răng ở DB**
> (mỗi đơn tối đa MỘT dòng cọc và MỘT dòng tiền thuê); và **đổi cơ sở tính toán** của một màn hình
> đã chạy (dialog trả váy hoàn cọc theo số THỰC THU thay vì cọc chuẩn trong danh mục).

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Tiền cọc (`deposit`) | Tiền tiệm GIỮ của khách, hoàn lại khi trả váy | kind đã có trong CHECK của bảng `payments`, **chưa từng được ghi** |
| Cọc chuẩn (`depositAmount`) | `dresses.deposit_amount` — con số **tham chiếu** trong danh mục | đã có; là số dùng để GỢI Ý, không phải số đã thu |
| Cọc đã thu (`summary.deposit`) | Tổng các dòng `payments` kind `deposit` của đơn | mới |
| Tiền thuê (`rental_fee`) | Tiền công thuê váy của đơn | kind đã có trong CHECK, chưa từng được ghi |
| Giá thoả thuận (`agreedPrice`) | `rental_items.price` — giá chốt với KHÁCH NÀY cho từng váy | đã có trong DB, **mới** trên contract; là số dùng để gợi ý tiền thuê |
| Đơn mở | `booked` hoặc `out` — còn đang chạy, còn thu tiền được | mới (§6.Q5) |
| Đơn đóng | `returned` hoặc `cancelled` — đã tất toán hoặc đã huỷ | mới (§6.Q5) |
| Ghi nhận (record) | Chép một khoản tiền ĐÃ ĐỔI TAY vào sổ. Không phải lệnh thu, không phải hoá đơn | phạm vi MVP |

## 2. Use-case specification

```text
Use case: RecordCollection — use case ĐỨNG RIÊNG của payments (không gắn vào pickup/create)
Actor: staff (bất kỳ ai đã đăng nhập)
Authorization: payment:collect — staff được ghi tiền, vì staff là người đứng quầy nhận tiền
Trigger: POST /api/v1/rentals/:rentalId/payments/collect từ dialog "Tiền của lượt thuê"
Đọc kèm: GET /api/v1/rentals/:rentalId/payments (query đã có, nay trả thêm `summary`)

Business input:
  - rentalId  (path)
  - deposit?   (VND integer ≥ 1; VẮNG = lần này không ghi cọc)
  - rentalFee? (VND integer ≥ 1; VẮNG = lần này không ghi tiền thuê)
  - note?      (ghi chú, ghi lên MỌI dòng do lệnh này tạo)

Preconditions:
  - Đơn tồn tại
  - Đơn đang MỞ (booked|out)
  - Khoản định ghi CHƯA có dòng nào trong đơn

Business flow (mỗi bước từ chối đều có outcome):
  1. Load trạng thái đơn                                   → rejected_rental_not_found
  2. Đơn phải đang mở                                      → rejected_rental_closed (+ currentStatus)
  3. Phải có ít nhất một khoản > 0                         → rejected_nothing_to_record
  4. deposit đã có dòng?                                   → rejected_deposit_already_recorded (+ recordedAmount)
  5. rentalFee đã có dòng?                                 → rejected_rental_fee_already_recorded (+ recordedAmount)
  6. Ghi 1..2 dòng payments trong MỘT transaction          → 200 + IdResponse(rentalId)
  7. Race thua UNIQUE index → truy vấn lại số đã ghi và trả ĐÚNG outcome của bước 4/5

Domain rules / invariants:
  - R1 (AC1): lệnh này chỉ ghi kind `deposit` và `rental_fee`. Ba kind tất toán
              (`deposit_refund`, `late_fee`, `damage_fee`) vẫn thuộc return flow của rentals —
              một khoản tiền có đúng một nơi sinh ra nó.
  - R2 (AC1): số tiền là VND integer ≥ 1 (BR-4). 0 nghĩa là "không thu", và cách diễn đạt
              "không thu" là VẮNG MẶT field, không phải số 0 — sổ không có dòng 0₫.
  - R3 (AC2): mỗi đơn tối đa MỘT dòng `deposit` và MỘT dòng `rental_fee`. Chặn ở
              **partial UNIQUE index** chứ không chỉ ở application code — cùng triết lý với
              FR-RENT-02 (invariant #6 của repo).
  - R4 (AC3): chỉ ghi được trên đơn MỞ. Đơn đã trả đã tất toán xong; đơn đã huỷ không có nghiệp vụ
              thu tiền. Tiền vào một đơn đã đóng gần như luôn là gõ nhầm đơn.
  - R5 (AC1): hai khoản trong một lệnh ghi CÙNG transaction — không có trạng thái "ghi được cọc,
              trượt tiền thuê".
  - R6: sổ chỉ ghi thêm (append-only). Feature này KHÔNG sửa/xoá dòng đã ghi (§6.Q5 — open).
  - R7 (AC5): mọi chỗ tính "hoàn cọc" phải lấy CỌC ĐÃ THU làm cơ sở; cọc chuẩn chỉ được dùng khi
              đơn chưa ghi nhận cọc, và khi đó màn hình phải NÓI RÕ đó là số tham chiếu (§6.Q3).

Side effects / domain events:
  - thành công → PaymentRecordedDomainEvent cho mỗi dòng (0 consumer, giữ đúng pattern repo)
  - mọi outcome từ chối → không ghi dòng nào, trạng thái đơn không đổi (lệnh này KHÔNG đụng rentals)

Idempotency: not required — R3 làm việc đó. Gửi lại đúng request sau timeout sẽ nhận
  rejected_deposit_already_recorded kèm SỐ ĐÃ GHI, tức là màn hình nói đúng sự thật thay vì
  ghi đúp (nhất quán ADR 0001 §5).
Concurrency: hai thiết bị cùng ghi cọc một đơn → UNIQUE index cho một bên thắng; bên thua truy vấn
  lại và nhận cùng outcome như pre-check, với số tiền bên thắng vừa ghi.
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload the FE needs |
| --- | --- | --- | --- |
| *(không có status)* | Đã ghi vào sổ | 200 | `IdResponse` (id của ĐƠN — lệnh tạo 1..2 dòng, không có một id duy nhất để trả) |
| `rejected_rental_not_found` | Đơn không tồn tại | 422 | — |
| `rejected_rental_closed` | Đơn đã trả hoặc đã huỷ | 422 | `currentStatus` |
| `rejected_nothing_to_record` | Không có khoản nào để ghi | 422 | — |
| `rejected_deposit_already_recorded` | Đơn đã có dòng cọc | 422 | `recordedAmount` |
| `rejected_rental_fee_already_recorded` | Đơn đã có dòng tiền thuê | 422 | `recordedAmount` |

Không có outcome 403: ghi tiền là việc của staff đứng quầy (khác miễn/giảm phí trễ ở
[settle-late-fee](../rentals/settle-late-fee.md), vốn là quyền của chủ tiệm).

`rejected_nothing_to_record` là **outcome nghiệp vụ, không phải 400**: từng field đều hợp lệ khi
đứng riêng (vắng mặt là hợp lệ), cái sai là ở mức use case — "gọi lệnh ghi tiền mà không ghi gì".
ADR 0001 §2: 400 dành cho hình dạng request, outcome dành cho luật nghiệp vụ.

## 3. UI state matrix

Dialog **"Tiền của lượt thuê"** — nâng cấp `rental-payments-dialog.tsx` thành MỘT màn hình tiền cho
một đơn: các dòng đã ghi + tổng + (đơn mở) form ghi tiền. Nút mở dialog chuyển từ *chỉ hàng
`returned`* sang **mọi hàng** của `/rentals` (tiền có thể được ghi bất cứ lúc nào — §6.Q1).

| State | Condition | Display / action |
| --- | --- | --- |
| loading | query đang chạy | "Đang tải…"; form chưa hiện |
| empty (đơn mở) | chưa có dòng nào | "Chưa có khoản nào"; form ghi tiền hiện, hai ô **pre-fill** |
| empty (đơn đóng) | chưa có dòng nào | "Chưa có khoản nào"; **không** có form (R4) |
| có dòng | ≥ 1 dòng | danh sách dòng + hàng **Tổng đã thu / Đã hoàn** |
| form idle | đơn mở | `Tiền cọc` pre-fill = Σ cọc chuẩn; `Tiền thuê` pre-fill = Σ giá thoả thuận; mỗi ô đọc lại số đã gõ theo nhóm (`FormDescription`) |
| khoản đã ghi | `summary.deposit > 0` | ô tương ứng **ẩn**, thay bằng dòng "Đã ghi: {{amount}}" — không mời gõ thứ đã có |
| submitting | request đang bay | nút disabled + chặn double submit |
| accepted | 200 | toast "Đã ghi nhận tiền." + form đóng lại, danh sách + tổng refetch ngay |
| deposit-already | `rejected_deposit_already_recorded` | GIỮ dialog, message dưới ô Tiền cọc kèm số đã ghi; refetch để danh sách hiện dòng kia |
| fee-already | `rejected_rental_fee_already_recorded` | như trên, dưới ô Tiền thuê |
| rental-closed | `rejected_rental_closed` | toast nêu trạng thái + ẩn form + refetch |
| rental-gone | `rejected_rental_not_found` | toast + đóng dialog + refetch danh sách đơn |
| nothing-to-record | `rejected_nothing_to_record` | message chung trên form; thực tế FE đã disable nút khi cả hai ô trống |
| validation-error | 400 + `details[]` | `form.setError` theo field |
| network-error | timeout/mất mạng | toast lỗi + cho bấm lại (an toàn: lần 2 bị R3 chặn) |

Dialog **"Nhận về & tất toán"** (đổi cơ sở, không đổi luồng):

| State | Condition | Display |
| --- | --- | --- |
| có cọc đã thu | `summary.deposit > 0` | "Đã thu cọc: {{amount}}"; hoàn cọc pre-fill = `cọc đã thu − phí trễ đề xuất` |
| chưa ghi cọc | `summary.deposit = 0` | "Chưa ghi nhận tiền cọc — số dưới đây là cọc chuẩn trong danh mục"; giữ nguyên hành vi cũ |

Accessibility: khối tổng tiền và các message dùng `aria-live="polite"`; ô tiền có `inputMode="numeric"`;
nút xác nhận có trạng thái busy. Responsive: dialog cuộn được trên tablet dọc.

## 4. FE data needs

- **Trước command:** `GET /rentals/:rentalId/payments` → `{ data: [...], summary: { deposit,
  rentalFee, depositRefund, lateFee, damageFee } }`. `summary` do BE cộng (một nguồn số, có unit
  test ở projection) — FE không tự cộng movement để ra tiền.
- **Gợi ý số tiền:** từ `RentalListItemDto.dresses[]` đã có: cọc = Σ `depositAmount`, tiền thuê =
  Σ `agreedPrice` (**field mới** trên `RentalDressDto`, lấy từ `rental_items.price`).
- **Sau command:** `IdResponse` + invalidate query payments của đơn. Board/list KHÔNG đổi trạng
  thái nên không cần invalidate (khác các mutation rentals).
- **Dialog trả váy:** gọi thêm chính query payments đó để biết `summary.deposit` — không thêm
  endpoint mới, không nhét số tiền đã thu vào quote phí trễ (quote là hàm thuần của ngày + số váy).
- **Projection latency:** strongly consistent (đọc thẳng bảng).

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | ghi cọc + tiền thuê một lần → đúng 2 dòng, `summary` phản ánh, note nằm trên cả hai | application unit + `test:e2e` |
| AC1 | chỉ gửi `deposit` → đúng 1 dòng | application unit |
| AC2 | ghi cọc lần hai → `rejected_deposit_already_recorded` + `recordedAmount`, sổ vẫn 1 dòng | application unit + `test:e2e` |
| AC2 | hai request đồng thời → đúng MỘT dòng, request kia 422 (UNIQUE index, không phải app code) | `test:e2e` (invariant proof) |
| AC3 | đơn `returned`/`cancelled` → `rejected_rental_closed` + `currentStatus`, không ghi gì | application unit + `test:e2e` |
| AC4 | không gửi khoản nào → `rejected_nothing_to_record` | application unit |
| AC5 | đơn đã ghi cọc → dialog trả váy pre-fill hoàn cọc theo CỌC ĐÃ THU | vitest (FE) |
| AC5 | đơn chưa ghi cọc → dialog nói rõ đang dùng cọc chuẩn | vitest (FE) |
| — | `summary` cộng đúng theo kind | unit projection |
| — | contract không lệch | `pnpm contract:check` |

## 6. Decisions (chủ tiệm chốt 2026-08-10)

| # | Question | Quyết định |
| --- | --- | --- |
| 1 | Ghi tiền cọc lúc nào? | **Nút riêng, ghi lúc nào cũng được.** Không gắn vào tạo đơn (khách có thể chưa đưa tiền) cũng không gắn vào pickup (có khách chuyển khoản trước). Vì vậy đây là use case đứng riêng của `payments`, không phải một nhánh của lệnh rentals. |
| 2 | Số tiền cọc do ai quyết? | **Gợi ý = Σ cọc chuẩn của các váy trong đơn, sửa được.** Số ghi vào sổ luôn là số THỰC THU. Cùng lý do với pre-fill ở dialog trả váy: bảy chữ số gõ tay là bước dễ sai nhất. |
| 3 | Phí có trừ vào cọc không? | **Có** — hoàn cọc = cọc đã thu − phí. Đóng lại open question mở từ `rentals/settlement-clarity`: pre-fill ở dialog trả váy nay là quy tắc ĐƯỢC DUYỆT, và cơ sở đổi từ cọc chuẩn sang **cọc đã thu** (R7). |
| 4 | Phạm vi | **Cọc + tiền thuê cùng lúc.** Bảng `payments` đã có sẵn kind `rental_fee`; ghi cả hai thì tiệm đối soát được tiền mặt vào/ra thay vì một nửa. |

Quyết định phái sinh (agent chốt khi soạn spec, nêu rõ để chủ tiệm bác được):

| # | Vấn đề | Chốt | Vì sao dám chốt |
| --- | --- | --- | --- |
| 5 | Ghi tiền trên đơn đã trả/huỷ? | **Không** (R4) | Không phải luật tiền mới: là luật vòng đời, cùng họ với "đơn đã trả thì không huỷ được". Nới ra sau này chỉ là bỏ một điều kiện; đã ghi nhầm vào đơn đóng thì không gỡ được (R6). |
| 6 | Ghi sai số thì sửa thế nào? | **Ngoài phạm vi** — outcome nói rõ số đã ghi để nhân viên biết sổ đang có gì | Sổ append-only mà `amount ≥ 0` nên không ghi bù âm được. Sửa số đã ghi là FR riêng (`payments/correct-movement`), cần chủ tiệm quyết ai được sửa + lưu vết ra sao — đúng loại câu hỏi mà lane này cấm tự chế. |
| 7 | Thu cọc làm nhiều lần? | **Không** (R3: một dòng/đơn) | Chưa có nhu cầu; nếu tiệm cho trả góp cọc thì R3 và index phải đổi cùng lúc — ghi sẵn ở đây để lần sau không sửa lệch một nửa. |

---

## Contract check (02-contract-check.md)

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~blocker~~ **đã giải quyết** | Thời điểm + số tiền + phạm vi chưa chốt nên không có luật nào đo được | §6.Q1–Q4 | Chủ tiệm chốt 2026-08-10 |
| ~~blocker~~ **đã giải quyết** | Quy ước trừ phí vào cọc mới chỉ là giả định trong code (pre-fill của `settlement-clarity`) | [payments-aggregate.md](../payments-aggregate.md) §Open questions | §6.Q3 duyệt thành luật; R7 đổi cơ sở sang cọc đã thu |
| major | `RentalDressDto` thêm field `agreedPrice` → đổi contract dùng chung bởi board + list | `rental-dress.response.dto.ts` | Additive; sinh lại cả hai client trong cùng commit (invariant #1) |
| major | Hai kind `deposit`/`rental_fee` từ trước tới nay chưa từng có dòng nào; UI hiện `payments.kinds.*` đã có sẵn cả 5 nhãn | `public/locales/*/rentals.json` | Không phải việc mới — kiểm tra lại nhãn khi test |
| major | R3 chỉ có răng nếu index tồn tại; app-level check một mình là race | migration mới | Partial UNIQUE index + dịch lỗi UNIQUE thành ĐÚNG outcome của pre-check (pattern `RentalItemsOverlapError`) |
| minor | `IdResponse` trả id ĐƠN chứ không phải id dòng tiền | §2 flow bước 6 | Ghi rõ trong `@ApiOperation`; FE không dùng id này |
| minor | Endpoint đặt dưới `/rentals/:rentalId/payments/collect` tuy do payments sở hữu | init-monorepo-contract 02 §3 | Cùng thủ thuật với read slice đã có (tag `payments`, path đọc như sub-resource của rental) |
| minor | Migration `down` của feature này là DROP INDEX | `docs/releases/2026-08-10-r1` risk #3 | Không mất dữ liệu khi lùi — nêu trong readiness của release sau |

Không có finding ở mục 2 (leakage — outcome chỉ trả số đã ghi, không trả cả dòng), 4 (state
coverage — matrix có loading/empty/submitting/duplicate/timeout), 5 (read efficiency — một call
một màn hình, `summary` tránh FE tự cộng), 8 (idempotency — §2 nêu lý do R3 thay thế).

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

**Trạng thái:** hai blocker đã được chủ tiệm giải quyết ở §6 → spec `approved`, được phép feed
scaffold prompt. Ba `major` là việc phải làm TRONG lúc implement.

## 7. Re-sync as-built (2026-08-10)

Implement **khớp** spec, không lệch quy tắc nào. Nơi từng phần đã hạ cánh:

| Spec | Code |
| --- | --- |
| Aggregate + R2/R6 | `apps/be/src/modules/payments/domain/payment.entity.ts` (+ `payment.types.ts`, `payment.errors.ts`, event); unit `payment.entity.spec.ts` |
| R3 (răng ở DB) | migration `1754900000000_payments_one_collection_per_kind.js` — hai partial UNIQUE index; `down` là DROP INDEX nên **lùi được sau khi tiệm đã nhập liệu**, khác 0001–0003 |
| R1, R4, R5 + flow bước 1–7 | `commands/record-collection/record-collection.service.ts`; race dịch qua `CollectionConflictError` trong `database/payment.repository.ts` |
| Outcome catalog | `record-collection.http.controller.ts` + `record-collection.outcome.dto.ts`; ADR 0001 §3 (bảng `payments` mới) + §4 |
| Policy | `payments.policies.ts` — `payment:collect` cho mọi staff đã đăng nhập |
| §4 `summary` | `queries/payment.projection.ts::toPaymentSummaryDto` + `PaymentSummaryDto`; `list-payments` trả kèm |
| §4 gợi ý tiền thuê | `RentalDressDto.agreedPrice` (mới) — cả `rental-list.projection` lẫn `today-board.projection` lấy từ `rental_items.price` |
| UI state matrix §3 | `features/rentals/components/record-collection-form.tsx` + `rental-payments-dialog.tsx` (nay là màn hình tiền của đơn, mở được từ MỌI hàng); key vi/en `rentals:collect.*`, `rentals:payments.totals.*` |
| R7 (đổi cơ sở hoàn cọc) | `features/today/components/return-rental-dialog.tsx` đọc `summary.deposit`; `today:returnDialog.deposit.collected` vs `.standard` |
| Traceability §5 | 109 unit BE · 42 e2e (12 ca `payments-collection.e2e-spec.ts`) · 71 vitest FE · Playwright happy path |

Quyết định phát sinh khi code (đều nhỏ, ghi lại để không phải suy luận lại):

1. **`RentalLookupPort.exists()` → `findStatus()`**: lệnh thu cần trạng thái, read slice chỉ cần
   "có tồn tại không" — một method phục vụ cả hai (`findStatus(...) === null` là không tồn tại) thay
   vì hai method đọc cùng một hàng.
2. **`IdResponse` trả id của ĐƠN**: lệnh ghi 1..2 dòng nên không có một movement id để trả; FE
   không dùng giá trị này, nó chỉ giữ shape chung với các command khác.
3. **Nút trên `/rentals` đổi nhãn `Thanh toán` → `Tiền`** và hiện ở MỌI hàng: "thanh toán" trên một
   đơn vừa đặt (chưa có gì để tất toán) đọc sai nghĩa; màn hình giờ là sổ tiền của đơn.

Phát hiện phụ khi chạy Playwright (đã sửa cùng lượt, đáng nhớ): dialog trả váy **không**
invalidate query payments của đơn, nên sau khi tất toán, màn hình tiền trên `/rentals` vẫn hiện sổ
CŨ tới hết 60s `staleTime` — tiền vào/ra lệch nhau ngay trên màn hình đối soát. Luật invalidate của
repo vì thế rộng thêm một vế: **mutation nào ghi movement thì phải invalidate sổ của đơn đó**, không
chỉ board + list.

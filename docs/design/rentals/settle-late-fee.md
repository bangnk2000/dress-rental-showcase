# Settle late fee — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `rentals` (Core) |
| Status | **as-built 2026-08-10** — implement khớp spec; xem §7 |
| AC source | Open question trong [rentals-aggregate.md](../rentals-aggregate.md): *"Phí trễ hạn hiện nhập tay lúc return; nếu muốn tự tính theo ngày trễ → FR mới + design-tier"*. FR: **FR-RENT-09** |
| Rules approved by | Chủ tiệm — 2026-08-10 (4 quyết định ở §6) |
| Contract approved by | Chủ tiệm (đại diện cả hai phía; BE + FE cùng repo, cùng commit) — 2026-08-10 |

> Vì sao là design-tier: thêm **quy tắc nghiệp vụ mới** (cách tính tiền), thêm **denial có tên đầu
> tiên của repo** (403 outcome), và đổi **ngữ nghĩa một field đã có** trên `POST /rentals/:id/return`.

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Ngày trả (`endDate`) | Ngày cuối của khoảng thuê, **inclusive** — trả trong ngày này là đúng hạn | đã có |
| Ngày trễ (`daysLate`) | Số ngày dương lịch sau `endDate` đến ngày nhận váy về | mới, đã chốt (§6.Q1–Q2) |
| Đơn giá ngày trễ | **200.000₫ / ngày / váy** (cố định, không theo giá thuê) | đã chốt §6.Q1; env `LATE_FEE_PER_DRESS_PER_DAY` |
| Phí trễ đề xuất (`suggestedLateFee`) | `daysLate × số váy trong đơn × đơn giá ngày trễ` | hệ thống tính, tiệm đọc cho khách trước khi xác nhận |
| Phí trễ đã thu (`lateFee`) | Số tiền THỰC ghi vào `payments` kind `late_fee` | field đã có, **đổi ngữ nghĩa** (§6.Q4) |
| Miễn/giảm phí (`waiver`) | Thu ÍT hơn phí đề xuất — **chỉ owner**, và **bắt buộc ghi chú** | đã chốt §6.Q3 |
| Đệm giặt (cleaning buffer) | Khoảng chặn lịch sau ngày trả | **không** phải ngày trễ (§6.Q2) |

## 2. Use-case specification

```text
Use case: SettleLateFee — nằm TRONG rentals/return-rental (không phải use case đứng riêng)
Actor: staff (thu đúng phí đề xuất hoặc nhiều hơn); owner (được miễn/giảm)
Authorization: rental:return như hiện tại; thu ÍT hơn phí đề xuất là denial có tên (outcome 403)
Trigger: POST /api/v1/rentals/:id/return từ dialog "Nhận về & tất toán"
Đọc kèm: GET /api/v1/rentals/:id/late-fee (query mới) để dialog hiển thị số trước khi submit

Business input:
  - rentalId (path)
  - lateFee?      (VND integer; VẮNG = thu đúng phí đề xuất do server tính)
  - damageFee?    (như hiện tại)
  - depositRefund?(như hiện tại)
  - note?         (như hiện tại; BẮT BUỘC khi lateFee < phí đề xuất)

Preconditions:
  - Đơn tồn tại và ở trạng thái booked|out (đã có 2 outcome)

Business flow (mỗi bước từ chối đều có outcome):
  1. Load đơn                                              → rejected_rental_not_found
  2. Kiểm tra transition sang returned                     → rejected_return_not_allowed
  3. Tính phí đề xuất theo R1–R2
  4. Nếu lateFee < phí đề xuất và actor KHÔNG phải owner    → forbidden (late_fee_waiver_requires_owner)
  5. Nếu lateFee < phí đề xuất và note trống                → rejected_waiver_note_required
  6. Nếu lateFee > phí đề xuất                             → chấp nhận (thoả thuận riêng)
  7. Flip status → returned, ghi movements vào payments     → 200 + IdResponse

Domain rules / invariants:
  - R1 (AC1): daysLate = số ngày dương lịch sau endDate đến ngày nhận về, tối thiểu 0. Trả trong
              endDate ⇒ 0. Đệm giặt KHÔNG cộng vào (§6.Q2).
  - R2 (AC1): suggestedLateFee = daysLate × (số item của đơn) × LATE_FEE_PER_DRESS_PER_DAY.
              Không ân hạn, không trần (§6 mặc định đã chốt cùng Q1).
  - R3 (AC2): lateFee vắng ⇒ thu đúng suggestedLateFee. daysLate = 0 ⇒ suggested = 0, và lateFee
              tự nhập > 0 vẫn được phép (đó là khoản khác, staff ghi note) — không tự chặn.
  - R4 (AC3): lateFee < suggested chỉ owner được làm, và phải có note (audit tối thiểu).
  - R5 (AC2): payments luôn ghi số THỰC THU, không phải số đề xuất.
  - R6 (AC4): suggestedLateFee là hàm THUẦN của (endDate, ngày tham chiếu, số item, đơn giá cấu
              hình) — tính lại lúc nào cũng ra cùng kết quả; không lưu, không cache.

Side effects / domain events:
  - thành công → RentalReturned (đã có, 0 consumer) + các dòng payments (đã có)
  - mọi outcome từ chối → không ghi gì, đơn giữ nguyên trạng thái

Idempotency: not required — vòng đời đơn đã chặn lần return thứ hai (rejected_return_not_allowed),
  nên gửi lại cùng request không tạo thêm movement (nhất quán ADR 0001 §5).
Concurrency: hai thiết bị cùng tất toán một đơn → state machine cho một bên thắng, bên kia nhận
  rejected_return_not_allowed kèm currentStatus='returned'. Phí đề xuất tính trong cùng request,
  không đọc trạng thái chia sẻ nào khác.
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload the FE needs |
| --- | --- | --- | --- |
| *(không có status)* | Tất toán xong | 200 | `IdResponse` (giữ nguyên) |
| `rejected_rental_not_found` | Đơn không còn tồn tại | 422 | — *(đã có)* |
| `rejected_return_not_allowed` | Đơn không ở booked/out | 422 | `currentStatus` *(đã có)* |
| `rejected_waiver_note_required` | Giảm phí mà không ghi lý do | 422 | `suggestedLateFee`, `submittedLateFee` |
| `forbidden` | Staff cố thu ít hơn phí đề xuất | **403** | `reason: 'late_fee_waiver_requires_owner'`, `suggestedLateFee`, `submittedLateFee` |

`forbidden` là **outcome 403 đầu tiên** của repo — đúng luật arbitration trong
[ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) §2: guard chặn TRƯỚC use case thì là
envelope; denial **có tên trong spec** như đây là outcome body.

Query `GET /rentals/:id/late-fee` không có rejection nghiệp vụ: không tìm thấy đơn → **404 envelope**.

## 3. UI state matrix

Dialog "Nhận về & tất toán" (`apps/fe/src/features/today/components/return-rental-dialog.tsx`).

| State | Condition | Display / action |
| --- | --- | --- |
| idle (đúng hạn) | quote `daysLate = 0` | không có banner phí trễ; field trống |
| idle (trễ) | `daysLate > 0` | banner "Trễ {{days}} ngày · {{count}} váy → đề xuất {{amount}}"; field **pre-fill** số đó, sửa được |
| loading quote | dialog vừa mở | banner skeleton; nút xác nhận **disabled** (không submit khi chưa biết số) |
| submitting | request đang bay | nút disabled + spinner; chặn double submit |
| accepted | 200 | toast "Đã tất toán lượt thuê." + đóng + invalidate board/list *(đã có)* |
| waiver-forbidden | `forbidden` | GIỮ dialog, message dưới field: "Chỉ chủ tiệm được giảm phí trễ (đề xuất {{amount}})" |
| waiver-note-required | `rejected_waiver_note_required` | GIỮ dialog, focus field Ghi chú + message "Giảm phí phải ghi lý do" |
| rental-gone | `rejected_rental_not_found` | toast + đóng + invalidate *(đã có)* |
| not-allowed | `rejected_return_not_allowed` | toast nêu `currentStatus` + đóng + invalidate *(đã có)* |
| validation-error | 400 + `details[]` | `form.setError` theo field *(đã có)* |
| network-error | timeout/mất mạng | toast lỗi + cho bấm lại *(đã có; không có Idempotency-Key — an toàn vì lần 2 bị state machine chặn)* |
| quote-error | quote lỗi (5xx/timeout) | banner "không tính được phí trễ, nhập tay"; **không** chặn tất toán |

Accessibility: banner dùng `aria-live="polite"`; message waiver nhận focus khi xuất hiện; nút xác
nhận có trạng thái busy khi submitting.
Responsive: banner một dòng, xuống 2 dòng ở màn hẹp; dialog vẫn scroll trên tablet dọc.

## 4. FE data needs

- **Trước command:** `GET /rentals/:id/late-fee` → `{ rentalId, dueDate, referenceDate, daysLate,
  dressCount, dailyRateAmount, suggestedLateFee }`. Một call, đúng lúc dialog mở.
- **Sau command:** `IdResponse` + invalidate board/list như hiện tại.
- **Denormalization:** quote tự tính `dressCount` và tổng tiền để FE **không** phải gọi get-rental
  rồi tự cộng (tránh N+1 và tránh hai phía tự tính lệch nhau).
- **Projection latency:** read side strongly consistent (đọc thẳng bảng).

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | trả sau `endDate` 3 ngày, đơn 2 váy → `daysLate=3`, suggested = 3×2×200k | domain unit (R1, R2) |
| AC1 | trả trong `endDate` → `daysLate=0`, suggested 0 | domain unit (R1, R3) |
| AC1 | ngày trong đệm giặt KHÔNG tính là trễ | domain unit (R1) |
| AC2 | `lateFee` vắng → payments ghi đúng suggested | application unit + `test:e2e` |
| AC3 | staff gửi `lateFee` < suggested → 403 `forbidden`, không ghi payments, đơn còn `out` | application unit; provider `test:e2e`; consumer vitest |
| AC3 | owner gửi `lateFee` < suggested KHÔNG note → 422 `rejected_waiver_note_required` | application unit; `test:e2e` |
| AC3 | owner gửi `lateFee` < suggested CÓ note → 200, payments ghi số đã giảm | `test:e2e` |
| AC4 | quote gọi 2 lần cùng đơn/ngày → cùng kết quả | domain unit (R6) |
| — | contract không lệch | `pnpm contract:check` (drift gate thay provider contract test) |
| — | luồng trễ hạn end-to-end trên browser | Playwright |

## 6. Decisions (đã chốt 2026-08-10 — trước đây là Open questions)

| # | Question | Quyết định |
| --- | --- | --- |
| 1 | Đơn giá ngày trễ | **200.000₫/ngày/váy, cố định** (không theo % giá thuê). Không ân hạn, không trần. Đặt ở env `LATE_FEE_PER_DRESS_PER_DAY` như `CLEANING_BUFFER_DAYS`; chuyển sang DB chỉ khi tiệm cần tự sửa (YAGNI). |
| 2 | Đệm giặt có tính là trễ? | **Không.** Đệm giặt là thời gian nội bộ của tiệm; khách chỉ trễ khi vượt `endDate`. |
| 3 | Ai được miễn/giảm? | **Chỉ `owner`, và bắt buộc ghi chú lý do.** Staff thu đúng số đề xuất (hoặc hơn). Sinh ra outcome 403 `forbidden` + 422 `rejected_waiver_note_required`. |
| 4 | Ngữ nghĩa `lateFee` | **Đổi tại chỗ**: vắng = thu phí đề xuất (trước đây vắng = không thu). Breaking change có chủ ý; hai client trong repo được sinh lại trong cùng commit như ADR 0001 §5. |
| 5 | Trễ rồi mất/không trả | Ngoài phạm vi feature này; nếu cần thì là FR riêng (`rentals/write-off`). |

---

## Contract check (02-contract-check.md) — chạy lại sau khi §6 đã chốt

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~blocker~~ **đã giải quyết** | Ngữ nghĩa `lateFee` đổi mà không có kế hoạch | §6.Q4 | Chốt là breaking change có chủ ý; ghi vào ADR 0001 §5 + commit message, regenerate cả hai client cùng commit |
| ~~blocker~~ **đã giải quyết** | Công thức + quyền miễn giảm chưa chốt nên `forbidden` không đo được | §6.Q1–Q3 | R2/R4 giờ là quy tắc đo được; §1 hết nhãn proposed |
| major | Payload `forbidden` / `rejected_waiver_note_required` (`reason`, `suggestedLateFee`, `submittedLateFee`) chưa có trong contract | `return-rental.outcome.dto.ts` hiện chỉ 2 mã, không field payload | Mở rộng `ReturnRentalOutcomeDto` + `@ApiResponse({ status: 403, type })` |
| major | Thêm giá trị enum `status` (2 mã mới) là thay đổi enum theo §7 | cùng file | Additive; regenerate cả hai client cùng commit. FE đã có nhánh `default:` nên không crash |
| minor | Tên field đơn giá: chọn `dailyRateAmount` (VND) vì Q1 chốt số cố định, KHÔNG dùng `dailyRatePercent` | §1 vs §4 | Dùng `dailyRateAmount` xuyên suốt |
| minor | Query mới nằm trên tag `rentals` → Orval sinh hook vào slice sẵn có, không phát sinh folder | §4 vs init-monorepo-contract 02 §3 | — |

Không có finding ở mục 2 (leakage — quote chỉ trả số đã tính), 4 (state coverage — matrix đủ
loading/submitting/duplicate/timeout/permission; "empty" không áp dụng cho dialog), 5 (read
efficiency — một call một screen), 8 (idempotency — đã nêu lý do không cần trong §2).

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

**Trạng thái:** hai blocker đã được chủ tiệm giải quyết ở §6 ngày 2026-08-10 → spec `approved`,
được phép feed scaffold prompt. Hai `major` là việc phải làm TRONG lúc implement (không phải chặn).

## 7. Re-sync as-built (2026-08-10)

Implement **khớp** spec, không lệch quy tắc nào. Nơi từng phần đã hạ cánh:

| Spec | Code |
| --- | --- |
| R1, R2, R6 (hàm thuần) | `apps/be/src/modules/rentals/domain/late-fee.value-object.ts` + `RentalEntity.lateFeeQuote()`; unit `late-fee.value-object.spec.ts` |
| Ngày tham chiếu | `shopToday()` trong `libs/utils/date.ts` (`Asia/Ho_Chi_Minh`) — **quyết định phát sinh khi code**: tiền không được phụ thuộc timezone của VPS, nên fee dùng ngày của tiệm chứ không phải ngày của thiết bị như today-board |
| R3, R4, R5 + flow bước 4–7 | `return-rental.service.ts` (waiver check sau khi state machine chốt, trước `save()`) |
| Outcome 403 + 422 mới | `return-rental.http.controller.ts` + `return-rental.outcome.dto.ts`; ADR 0001 §3–§4 đã thêm hàng |
| Query §4 | `queries/quote-late-fee/*` → `GET /rentals/:id/late-fee`, handler gọi lại domain (không copy công thức) |
| UI state matrix §3 | `return-rental-dialog.tsx` (banner `aria-live`, prefill, submit chặn khi chưa có quote, 2 outcome giữ dialog) + key vi/en `today:returnDialog.lateFee.*`, `today:errors.*` |
| Traceability §5 | 95 unit BE · 57 vitest FE · 30 e2e (8 ca `late-fee.e2e-spec.ts`) · `contract:check` |

Lệch nhỏ so với §3 đã ghi lại: message của outcome `forbidden` KHÔNG nội suy số đề xuất vào field
error (message của form là i18n key, không nhận tham số) — số đề xuất vẫn hiển thị liên tục ở banner
phía trên, nên nhân viên vẫn đọc được. ADR 0001 §4 đã sửa theo đúng cách làm này.

Phát hiện phụ khi code (đã sửa cùng lượt): `lib/format.ts` đọc i18n singleton của app nên trong test
định dạng tiền ra kiểu Anh trong khi chữ là tiếng Việt; giờ đọc `<html lang>` — cùng một nguồn với
UI, không còn hai instance bất đồng.

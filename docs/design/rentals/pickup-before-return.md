# Chưa giao váy thì chưa nhận về — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `rentals` (Core) |
| Status | **approved 2026-08-10** — chủ tiệm đồng ý toàn bộ gợi ý §6 |
| AC source | Đề bài chủ tiệm 2026-08-10: *"chưa giao váy thì không được nhận về & tất toán; tạo đơn ngày nhận là ngày hiện tại thì trạng thái tự động chuyển sang đã giao"*. FR đề xuất: **FR-RENT-10** (kèm siết FR-RENT-05) |
| Rules approved by | Chủ tiệm — 2026-08-10 ("tôi đồng ý", chốt theo gợi ý agent ở §6) |
| Contract approved by | Chủ tiệm (đại diện cả hai phía, cùng repo cùng commit) — 2026-08-10 |

> Vì sao là design-tier: **đảo một quyết định as-built** — `markReturned` hiện cho phép
> `booked → returned` có chủ ý ("staff quên bấm giao thì vẫn trả được", FR-RENT-05); spec này rút
> nhánh đó đi, nghĩa là mọi surface đang mời "Nhận về & tất toán" trên đơn `booked` (due-back +
> overdue của board) phải đổi hành vi. Đồng thời `create` lần đầu tiên tạo đơn ở trạng thái khác
> `booked` — state machine, e2e happy path và smoke.sh đều xê dịch theo.

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Giao váy (`pickup`) | Khách cầm váy rời tiệm; đơn `booked → out` | đã có (FR-RENT-04) |
| Nhận về & tất toán (`return`) | Váy quay lại tiệm + chốt tiền; đơn `→ returned` | đã có; spec này SIẾT: chỉ từ `out` |
| Đơn giao ngay | Đơn tạo với ngày nhận = hôm nay (giờ tiệm) — khách đang đứng ở quầy | mới; sinh ra đã là `out` |
| Ngày tiệm (`shopToday`) | Ngày hiện tại theo `Asia/Ho_Chi_Minh` | đã có từ FR-RENT-09 — trạng thái đơn là nghiệp vụ tại quầy, không theo đồng hồ UTC của VPS lẫn đồng hồ thiết bị |

## 2. Use-case specification

```text
Use case: (a) siết ReturnRental + (b) auto-pickup trong CreateRental — MỘT feature vì cùng một
  luật sống: "trạng thái đơn phản ánh váy đang ở đâu"
Actor: staff (như hiện tại — rental:create / rental:return không đổi quyền)
Trigger: POST /rentals (create) · POST /rentals/:id/return (không đổi path/shape)

(a) Siết return:
  Business flow thay đổi đúng MỘT bước:
    - markReturned: CHỈ out → returned. booked → Err(ReturnNotAllowed)
      → outcome rejected_return_not_allowed (+ currentStatus='booked') — code ĐÃ CÓ,
        chỉ mở rộng tập trạng thái bị từ chối; payload currentStatus đã đủ cho FE phân nhánh
  Không đổi: returned/cancelled vẫn bị từ chối như cũ; toàn bộ luật tiền
  (late fee, waiver, deposit basis) giữ nguyên — chúng chạy SAU state machine.

(b) Auto-pickup khi tạo:
  Business flow (chèn vào create-rental hiện có, sau mọi pre-check):
    6b. Nếu period.start ≤/== shopToday() (§6.Q1)  → entity sinh ra đã markPickedUp
        (status='out'; events RentalCreated + RentalPickedUp cùng transaction)
  Không có outcome mới: các từ chối của create giữ nguyên.

Domain rules / invariants:
  - R1 (AC1): return chỉ hợp lệ từ `out`. Một đơn chưa giao thì chưa có gì để nhận về;
              tất toán một đơn chưa giao là ghi tiền cho một giao dịch chưa xảy ra.
  - R2 (AC2): đơn tạo với ngày nhận là hôm nay (giờ tiệm) sinh ra ở trạng thái `out` —
              khách đang ở quầy, bắt staff bấm thêm "Đã giao váy" là một bước thừa dễ quên.
  - R3 (AC3): ngày so sánh là shopToday() — KHÔNG lấy ngày thiết bị (khác today-board,
              nơi xem-ngày-khác là chủ ý; ở đây là trạng thái pháp lý của đơn).
  - R4: blocked_period/buffer KHÔNG đổi — auto-pickup chỉ đổi status, không đổi lịch block.

Side effects / domain events:
  - Đơn giao ngay → RentalCreated + RentalPickedUp (0 consumer, giữ stream nhất quán:
    không bao giờ có đơn `out` mà thiếu sự kiện PickedUp)
  - Từ chối return → không side effect (như hiện tại)

Idempotency: not required — return đã idempotent-hostile sẵn (re-return 409/422 by design);
  create giữ nguyên trạng thái hiện tại (chưa có Idempotency-Key — không tệ hơn).
Concurrency: không có race mới — auto-pickup quyết định TRONG create transaction;
  pickup-vs-return trên cùng đơn đã là last-write-accepted của MVP (rentals-aggregate.md).
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload |
| --- | --- | --- | --- |
| `rejected_return_not_allowed` | Trạng thái hiện tại không cho nhận về — **nay gồm cả `booked`** | 422 | `currentStatus` (đã có) |
| `rejected_cancel_not_allowed` | như hiện tại — nhưng đơn `out` **sổ trống** nay được huỷ (§6.Q2) | 422 | `currentStatus` (đã có) |
| `rejected_cancel_has_payments` | **mới** — huỷ đơn `out` đã có dòng tiền: buộc đi đường return | 422 | — |

Return không thêm code mới: "chưa giao" và "đã đóng" là hai câu chuyện với STAFF nhưng là một
luật với máy — "state machine từ chối return từ trạng thái này" — và `currentStatus` đã chở đủ
thông tin để FE hiện đúng message từng trường hợp (ADR 0001 §3 chỉ thêm dòng cho cancel).

## 3. UI state matrix

Chỉ các state ĐỔI so với hiện tại:

| State | Condition | Display / action |
| --- | --- | --- |
| due-back/overdue, đơn `booked` | board card của đơn chưa giao mà đã tới/quá ngày trả | **Không** còn nút "Nhận về & tất toán". Thay bằng nhãn "Khách chưa lấy váy" + nút `Giao váy` (nếu tiệm vẫn giao trễ) và nút `Huỷ đơn` (§6.Q2) |
| return bị chặn | outcome `rejected_return_not_allowed` + `currentStatus='booked'` | message riêng: "Đơn chưa giao váy — giao trước khi nhận về", KHÔNG dùng chung câu "đã xử lý" của returned/cancelled |
| create thành công, đơn giao ngay | 201 + đơn start = hôm nay | toast nói rõ "Đã tạo và giao váy"; list/board hiện badge `Đang thuê` ngay (invalidate như cũ) |
| new-rental form, start = hôm nay | trước submit | dòng phụ dưới ô ngày: "Ngày nhận là hôm nay — đơn sẽ ghi là ĐÃ GIAO" để staff không bất ngờ |

Accessibility: message chặn-return nằm trong vùng lỗi `aria-live` sẵn có của dialog; dòng phụ
trên form gắn qua `aria-describedby` của ô ngày. Responsive: không đổi layout.

## 4. FE data needs

Không cần endpoint/field mới: `status` + `period` đã có trên mọi read (board, list). FE tự suy
"đơn booked trên due-back" từ dữ liệu đang render. Read side strongly consistent như cũ.

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | return đơn `booked` → `rejected_return_not_allowed` + currentStatus, đơn không đổi, 0 dòng tiền | domain unit + `test:e2e` |
| AC1 | return đơn `out` → vẫn `returned` như cũ (không hồi quy) | e2e hiện có |
| AC2 | create start = shopToday → 201, DB status `out`, đủ 2 events | application unit + `test:e2e` |
| AC2 | create start = ngày mai → vẫn `booked` | application unit |
| AC3 | §6.Q1: create start < hôm nay → trạng thái theo quyết định Q1 | application unit |
| — | board: card due-back `booked` không còn nút return, có nhãn + action thay thế | vitest (FE) |
| — | happy path Playwright VIẾT LẠI: đơn hôm nay sinh ra đã `out` → bước bấm "Đã giao váy" biến mất khỏi kịch bản chính; nút pickup chứng minh bằng đơn đặt trước (start = mai) | e2e |

**Cảnh báo test-impact (lý do feature này không "nhỏ"):** smoke.sh dựng fixture đơn ngày quá khứ
rồi lần lượt pickup/return; Playwright bấm nút pickup trên đơn tạo hôm nay. Cả hai kịch bản đổi
theo Q1/R2 — phải sửa CÙNG commit với BE.

## 6. Decisions (chủ tiệm chốt 2026-08-10 — "tôi đồng ý", toàn bộ theo gợi ý agent)

| # | Question | Quyết định |
| --- | --- | --- |
| 1 | Đơn tạo với ngày nhận trong QUÁ KHỨ | **auto-`out`** (luật là start ≤ shopToday) — nhập bù nghĩa là váy ĐÃ giao |
| 2 | Đơn giao ngay bị tạo nhầm | **Mở cancel cho `out` khi sổ tiền TRỐNG** — đơn đã ghi tiền thì buộc đi đường return; cancel cần pre-check sổ qua port đọc payments mới (cross-context, kiểu DressLookupPort) |
| 3 | Đơn `booked` khách không bao giờ lấy | **Nút `Huỷ đơn` ngay trên card** due-back/overdue — đảo quyết định "board không có cancel" vì card này không còn action nào khác |

Quyết định phái sinh (agent chốt, nêu rõ để bác được):

| # | Vấn đề | Chốt | Vì sao |
| --- | --- | --- | --- |
| 4 | Code outcome | Dùng lại `rejected_return_not_allowed` + `currentStatus`, không thêm code | payload đã phân biệt được; thêm code mới là hai tên cho một luật state machine |
| 5 | Ngày tham chiếu | `shopToday()` (Asia/Ho_Chi_Minh), không phải ngày thiết bị | cùng họ với luật tiền FR-RENT-09; trạng thái đơn không được đổi theo múi giờ thiết bị |
| 6 | Buffer/lịch block | không đổi gì | auto-pickup là chuyện status; lịch đã đúng từ create |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~blocker~~ **đã giải quyết** | Q1 chốt: start ≤ shopToday → auto-`out`; smoke.sh fixtures đổi theo | §6.Q1 | sửa smoke cùng commit |
| ~~blocker~~ **đã giải quyết** | Q2 chốt: cancel mở cho `out` sổ-trống — cancel thêm pre-check sổ tiền qua `PaymentLedgerPort` mới (đọc bảng payments, kiểu DressLookupPort; deviation #4 mở rộng) | §6.Q2 | outcome mới `rejected_cancel_has_payments` khi sổ có dòng |
| ~~major~~ **đã giải quyết** | Q3 chốt: card due-back/overdue của đơn `booked` có nút Huỷ | §6.Q3 | implement theo matrix §3 |
| major | Happy path e2e + smoke.sh đổi kịch bản — phải sửa cùng commit, không phải hậu kỳ | §5 cảnh báo | ghi vào evidence khi implement |
| minor | `markReturned` bỏ nhánh booked → message vi/en cho `currentStatus='booked'` phải thêm key mới | §3 | thêm key `rentals:return.notPickedUp` |
| minor | Không có thay đổi contract shape nào (không field/endpoint mới) — chỉ semantics của status sau create | §2 | ghi chú trong `@ApiOperation` của create |

Mục 1 (naming), 2 (leakage), 5 (read efficiency), 8 (idempotency): không có finding —
không field mới, không endpoint mới, không đổi replay semantics.

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

## 7. Re-sync as-built (2026-08-10)

Implement khớp spec với các quyết định phát sinh, đều ghi rõ:

1. **Auto-pickup = `create()` rồi `markPickedUp()`** ngay trong service — không thêm nhánh
   factory; stream event tự nhiên (Created + PickedUp cùng transaction, không bao giờ có đơn
   `out` thiếu event).
2. **Ledger guard phủ CẢ cancel đơn `booked`** — từ FR-PAY-02, đơn booked cũng cầm được tiền
   cọc; luật "sổ có tiền thì đi đường return" là một luật, không phân biệt trạng thái. Check
   chạy dưới row lock trong `RentalRepository.saveCancelled` (cùng pattern `saveReturned`);
   record-collection lock cùng hàng nên hai luồng take turns, không deadlock.
3. **List `/rentals` thêm nút Huỷ cho hàng `out`** — đó là chỗ thao tác tự nhiên cho đơn giao
   ngay bị tạo nhầm (board chỉ hiện đơn đến hạn); BE là người quyết có tiền hay không.
4. **smoke.sh viết lại sang NGÀY TƯƠNG ĐỐI** (anchor D0 = today+3) — ngày cố định 08/2026 đã
   thối theo lịch; tiện thể sửa các expect 409 còn sót từ trước ADR 0001 thành 422 outcome
   (script vốn đã không chạy nổi từ khi outcome model land). Thêm section FR-RENT-10:
   born-out, pickup 422, collect→cancel 422, return là lối ra.
5. **Playwright happy path đổi kịch bản**: đặt cho NGÀY MAI rồi bấm "Ngày sau" trên board —
   luồng duy nhất mà browser còn chứng minh được nút giao váy; born-out để unit/e2e/smoke lo.

| Spec | Code |
| --- | --- |
| R1 (return chỉ từ out) | `rental.entity.ts::markReturned`; e2e `pickup-gate.e2e-spec.ts` AC1 |
| R2/R3 (born-out theo shopToday) | `create-rental.service.ts` (so `period.start <= shopToday()`); 3 unit case (same-day, backdated, múi giờ Hà Nội) + e2e |
| §6.Q2 (cancel + sổ tiền) | entity.cancel mở cho out; `saveCancelled` + `LedgerNotEmptyError` → `RentalCancelHasPaymentsError` → `rejected_cancel_has_payments`; e2e cả hai chiều (sổ trống 200 + giải phóng lịch, có tiền 422 + item vẫn block) |
| §6.Q3 (board card booked) | `today-route.tsx::returnAction` status-aware: nhãn + Giao váy + Huỷ (ConfirmDialog); vitest 2 case |
| §3 UI states | return dialog câu riêng cho `currentStatus='booked'`; form note `rentals:form.startsToday`; toast `form.successDelivered` |
| Traceability §5 | be 130 unit (+4) · 62 e2e (+7, `pickup-gate.e2e-spec.ts`) · fe 89 vitest (+2, 1 sửa) · Playwright 1 passed (17.5s) trên stack thật · smoke.sh viết lại |

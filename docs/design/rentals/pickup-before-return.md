# Chưa giao váy thì chưa nhận về — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `rentals` (Core) |
| Status | **draft** — chờ chủ tiệm trả lời §6 |
| AC source | Đề bài chủ tiệm 2026-08-10: *"chưa giao váy thì không được nhận về & tất toán; tạo đơn ngày nhận là ngày hiện tại thì trạng thái tự động chuyển sang đã giao"*. FR đề xuất: **FR-RENT-10** (kèm siết FR-RENT-05) |
| Rules approved by | *(trống — draft)* |
| Contract approved by | *(trống — draft)* |

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

Không thêm code mới: "chưa giao" và "đã đóng" là hai câu chuyện với STAFF nhưng là một luật với
máy — "state machine từ chối return từ trạng thái này" — và `currentStatus` đã chở đủ thông tin
để FE hiện đúng message từng trường hợp (ADR 0001 §3 không phải thêm dòng). *Quyết định phái
sinh #1, bác được.*

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

## 6. Open questions — blocker cho chủ tiệm

| # | Question | Owner | Gợi ý của agent |
| --- | --- | --- | --- |
| 1 | Đơn tạo với ngày nhận trong **QUÁ KHỨ** (nhập bù đơn cũ) — cũng auto-`out`, hay giữ `booked`? | chủ tiệm | auto-`out` (start ≤ hôm nay): nhập bù nghĩa là váy ĐÃ giao rồi; giữ `booked` bắt staff bấm giao cho một việc đã xảy ra |
| 2 | Đơn giao ngay bị **tạo nhầm** thì xử lý sao? Cancel hiện chỉ cho `booked` — đơn sinh ra đã `out` sẽ KHÔNG huỷ được, chỉ có đường return + tất toán 0đ. Có mở cancel cho đơn `out` chưa-có-dòng-tiền không? | chủ tiệm | mở cancel cho `out` **chỉ khi** đơn chưa có dòng tiền nào (sổ trống) — gõ nhầm là chuyện có thật ở quầy; đơn đã ghi tiền thì buộc đi đường return để sổ không mất vết |
| 3 | Khách đặt trước nhưng KHÔNG BAO GIỜ đến lấy (đơn `booked` quá hạn) — tiệm muốn nút gì trên board? | chủ tiệm | `Huỷ đơn` ngay trên card (trước đây board cố ý không có cancel — quyết định đó đảo lại ở đây vì giờ card này không còn action nào khác) |

Quyết định phái sinh (agent chốt, nêu rõ để bác được):

| # | Vấn đề | Chốt | Vì sao |
| --- | --- | --- | --- |
| 4 | Code outcome | Dùng lại `rejected_return_not_allowed` + `currentStatus`, không thêm code | payload đã phân biệt được; thêm code mới là hai tên cho một luật state machine |
| 5 | Ngày tham chiếu | `shopToday()` (Asia/Ho_Chi_Minh), không phải ngày thiết bị | cùng họ với luật tiền FR-RENT-09; trạng thái đơn không được đổi theo múi giờ thiết bị |
| 6 | Buffer/lịch block | không đổi gì | auto-pickup là chuyện status; lịch đã đúng từ create |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| blocker | Q1 (đơn quá khứ) chưa chốt — smoke.sh/nhập bù phụ thuộc trực tiếp | §6.Q1 | chủ tiệm quyết |
| blocker | Q2 (thoát nhầm cho đơn giao ngay) chưa chốt — thiếu nó, một cú gõ nhầm thành đơn không huỷ được | §6.Q2 | chủ tiệm quyết; nếu chọn "mở cancel cho out sổ-trống" thì cancel cần thêm pre-check sổ tiền (đọc payments qua port mới — cross-context, nêu rõ khi implement) |
| major | Board due-back/overdue với đơn `booked` mất action chính — cần Q3 để card không thành ngõ cụt | §3 matrix | chủ tiệm quyết Q3 |
| major | Happy path e2e + smoke.sh đổi kịch bản — phải sửa cùng commit, không phải hậu kỳ | §5 cảnh báo | ghi vào evidence khi implement |
| minor | `markReturned` bỏ nhánh booked → message vi/en cho `currentStatus='booked'` phải thêm key mới | §3 | thêm key `rentals:return.notPickedUp` |
| minor | Không có thay đổi contract shape nào (không field/endpoint mới) — chỉ semantics của status sau create | §2 | ghi chú trong `@ApiOperation` của create |

Mục 1 (naming), 2 (leakage), 5 (read efficiency), 8 (idempotency): không có finding —
không field mới, không endpoint mới, không đổi replay semantics.

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

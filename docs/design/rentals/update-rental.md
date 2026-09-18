# Chi tiết đơn & sửa đơn (chủ tiệm) — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `rentals` (Core) |
| Status | **as-built 2026-09-18** — spec và code cùng một session theo yêu cầu trực tiếp của chủ tiệm; **các quyết định §6 là mặc định do agent chốt**, chủ tiệm bác được từng dòng (mỗi dòng bác = một thay đổi nhỏ, có đánh dấu chỗ sửa) |
| AC source | Đề bài chủ tiệm 2026-09-18: *"thêm tính năng sửa đơn và chi tiết đơn cho tài khoản chủ cửa hàng"*. FR đề xuất: **FR-RENT-12** (chi tiết đơn) + **FR-RENT-13** (sửa đơn, owner-only) |
| Rules approved by | Chưa — mặc định agent ở §6, chờ chủ tiệm xác nhận sau khi test tay |
| Contract approved by | Chủ tiệm (đại diện cả hai phía, cùng repo cùng commit) |

> Vì sao là design-tier: aggregate nhận **thao tác mới** `update()` — viết lại `blocked_period` của
> MỌI item và thêm/bớt item — nên BR-1 (chống trùng lịch) phải đúng cả khi sửa: pre-check phải bỏ
> qua chính các dòng của đơn đang sửa, và đường race (EXCLUDE bắn) phải ra cùng outcome như
> pre-check. Đồng thời là **quyền ghi owner-only đầu tiên của rentals** (`rental:update`) và một
> pattern tương tác FE mới (route chi tiết + route sửa dùng lại form tạo đơn).

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Chi tiết đơn (`rental detail`) | Một màn hình cho MỘT đơn: khách, ngày, váy + giá thoả thuận, giảm giá, ghi chú, trạng thái, sổ tiền, và các hành động | mới — `GET /rentals/:id`; lần đầu `notes` được hiển thị |
| Sửa đơn (`update rental`) | Chủ tiệm viết lại NỘI DUNG đơn khi đơn còn mở: khách, ngày, váy, giá từng váy, giảm giá, ghi chú. **Không** đổi trạng thái — pickup/return/cancel vẫn là chủ của status | mới — `PATCH /rentals/:id`, policy `rental:update` owner-only |
| Đơn MỞ (`open rental`) | `booked` hoặc `out` | đã có từ FR-PAY-02 |
| Váy GIỮ LẠI / váy THÊM MỚI / váy BỎ | Giữ lại = có trên đơn trước và sau khi sửa (giữ nguyên dòng + giá đã thoả thuận); thêm mới = dòng mới, giá chuẩn catalog; bỏ = dòng bị XOÁ | luật retired chỉ áp cho váy thêm mới (§6.Q4) |
| Kỳ block hiện hành | Sau mỗi lần sửa, MỌI item block = kỳ thuê mới + `CLEANING_BUFFER_DAYS` hiện hành | đơn tạo lúc buffer=2, sửa lúc buffer=1 → block theo 1 (luật tiệm đang chạy) |

## 2. Use-case specification

```text
Use case: UpdateRental (command) + GetRental (read slice) — MỘT feature vì màn hình chi tiết
  là nơi nút "Sửa đơn" sống, và form sửa đọc chi tiết để prefill
Actor: UpdateRental — owner (policy `rental:update`, fail-closed; staff → 403 ENVELOPE
  GENERIC.FORBIDDEN vì guard chặn TRƯỚC khi use case chạy — ADR 0001 §2, giống user:manage).
  GetRental — mọi nhân viên đã đăng nhập (read = auth only, như mọi read khác — §6.Q1).
Trigger: PATCH /rentals/:id từ màn sửa · GET /rentals/:id từ màn chi tiết

Business input (PATCH — mọi field tuỳ chọn, bỏ qua = giữ nguyên):
  - customerName, customerPhone
  - startDate, endDate (một hoặc cả hai; gộp với kỳ hiện tại rồi mới validate start ≤ end)
  - notes (string | null — null xoá ghi chú)
  - discountAmount (≥ 0)
  - items[] — DANH SÁCH ĐẦY ĐỦ mới (thay thế): { dressId, price? }
      price bỏ qua: váy giữ lại GIỮ giá đã thoả thuận; váy thêm mới lấy giá chuẩn catalog
      price gửi: ghi đúng số đó (cả váy giữ lại lẫn thêm mới)

Preconditions:
  - Đơn tồn tại                                           → rejected_rental_not_found
  - Đơn còn MỞ (booked|out)                               → rejected_update_not_allowed { currentStatus }

Business flow (mỗi bước từ chối nêu outcome):
  1. Guard rental:update (owner)                          → 403 envelope (guard, không phải outcome)
  2. Load aggregate; không có                             → rejected_rental_not_found
  3. status ∉ {booked, out}                               → rejected_update_not_allowed { currentStatus }
  4. Gộp kỳ thuê mới; ngày sai / start > end              → 400 envelope (RentalPeriod VO throw)
  5. Danh sách váy mới (mặc định = hiện tại); tra catalog:
       id không tồn tại                                   → rejected_dress_not_found { dressIds }
       váy THÊM MỚI đã retired                            → rejected_dress_retired { dressIds }
       (váy giữ lại mà retired sau khi đặt: KHÔNG chặn — §6.Q4)
  6. Pre-check BR-1 trên kỳ block mới (kỳ + buffer) cho MỌI váy của danh sách mới,
     BỎ QUA chính các dòng của đơn này                    → rejected_dress_unavailable { dressIds }
  7. entity.update(): reconcile item (giữ lại = giữ id + giá trừ khi gửi giá; thêm mới = id mới;
     bỏ = drop), MỌI item block = kỳ mới + buffer; validate() giảm giá ≤ Σ giá item mới → 400 envelope
  8. repo.saveUpdated(): MỘT transaction, dưới row lock của đơn (SELECT … FOR UPDATE):
       đọc lại status — không còn mở (cancel/return vừa chen vào giữa load và save)
                                                          → rejected_update_not_allowed { currentStatus }
       DELETE các dòng item bị bỏ → upsert rentals + rental_items
       EXCLUDE bắn (thua race với create/update khác)      → RentalItemsOverlapError
                                                          → rejected_dress_unavailable (CÙNG outcome pre-check)
  9. Ok(id) · RentalUpdatedDomainEvent { aggregateId, dressIds } (0 consumer)

Domain rules / invariants:
  - R1 (AC1): chỉ đơn MỞ mới sửa được; update KHÔNG BAO GIỜ đổi status. Không lặp lại luật
              "born-out" của create: sửa ngày nhận về hôm nay không phải là giao váy (§6.Q3).
  - R2 (AC2): BR-1 xuyên suốt lần sửa — kỳ block mới của mọi item (giữ lại lẫn thêm mới) không
              được giao với item blocking của đơn KHÁC; dòng của chính đơn không tự xung đột.
              Cơ chế DB vẫn là EXCLUDE `rental_items_no_overlap` (không thêm object DB mới).
  - R3 (AC3): danh tính item là VÁY: giữ lại → cùng dòng, cùng giá (trừ khi gửi giá);
              thêm mới → dòng mới, giá chuẩn (trừ khi gửi giá); bỏ → XOÁ dòng (§6.Q5).
  - R4 (AC4): giảm giá ≤ Σ giá item MỚI (FR-RENT-11 áp lại trên danh sách mới).
  - R5: sổ tiền KHÔNG bị đụng — sửa đổi số GỢI Ý (Σ giá − giảm), không đổi số đã thu (§6.Q7).
  - R6 (AC6): GET /rentals/:id = aggregate + snapshot váy + `blockedUntilDate` từng item + `notes`.

Side effects / domain events:
  - Ok → RentalUpdated (0 consumer — giữ stream nhất quán, không xây listener trước nhu cầu)
  - mọi rejected_* → không side effect, không ghi gì

Idempotency: not required — PATCH mang trạng thái đầy đủ của phần gửi lên; gửi lại cùng body cho
  cùng kết quả, không tạo gì mới.
Concurrency:
  (a) sửa vs create/sửa đơn KHÁC cùng váy cùng khoảng: EXCLUDE chọn người thắng, người thua nhận
      rejected_dress_unavailable — e2e bắn PATCH và POST đồng thời.
  (b) sửa vs cancel/return/record-collection trên CÙNG đơn: saveUpdated lấy cùng row lock mà
      saveCancelled/saveReturned/record-collection lấy, và đọc lại status dưới lock — một cancel
      chen ngang không bao giờ bị bản sửa cũ ghi đè thành booked + blocking=true.
  (c) hai OWNER cùng sửa một đơn: last-write (MVP, như rentals-aggregate.md ghi — không version column).
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload |
| --- | --- | --- | --- |
| `rejected_rental_not_found` | (dùng lại) đơn không còn | 422 | — |
| `rejected_update_not_allowed` | **mới** — đơn đã `returned`/`cancelled` (pre-check HOẶC phát hiện dưới row lock) | 422 | `currentStatus` |
| `rejected_dress_not_found` | (dùng lại từ create) id váy không tồn tại | 422 | `dressIds[]` (váy vi phạm) |
| `rejected_dress_retired` | (dùng lại) váy THÊM MỚI đã retired | 422 | `dressIds[]` |
| `rejected_dress_unavailable` | (dùng lại) kỳ block mới trùng đơn khác — pre-check LẪN race | 422 | `dressIds[]` |

Không có outcome 403 có tên: "không phải owner" là luật của TOÀN endpoint, không phải một
nhánh trong use case → guard `PoliciesGuard` chặn → 403 **envelope** `GENERIC.FORBIDDEN`
(§6.Q8). `GET /rentals/:id` không có từ chối nghiệp vụ; không thấy row → 404 envelope.

## 3. UI state matrix

### `/rentals/:id` — chi tiết (mọi nhân viên)

| State | Condition | Display / action |
| --- | --- | --- |
| loading | suspense query get-rental | spinner của RouteBoundary |
| not-found / fault | 404 hoặc lỗi server | route error boundary (như `/dresses/:id`) |
| loaded | 200 | tiêu đề = tên khách + badge trạng thái; lưới thông tin: điện thoại (tel:), ngày nhận – ngày trả, "váy được giữ tới hết {blockedUntil}" (giặt ủi), giảm giá, tiền thuê dự kiến = Σ giá thoả thuận − giảm, ghi chú (lần đầu hiển thị), ngày tạo; danh sách váy (mã → link `/dresses/:id`, tên, giá thoả thuận) |
| actions (open) | status `booked`/`out` | `Sửa đơn` (CHỈ owner — display; BE policy là luật) → `/rentals/:id/edit` · `Huỷ` (ConfirmDialog, cùng mutation/outcome như list, invalidate list + board + detail) · `Tiền` (mở `RentalPaymentsDialog` dùng chung với list) |
| actions (closed) | `returned`/`cancelled` | chỉ `Tiền`; không có `Sửa đơn`/`Huỷ` |
| staff | me.role ≠ owner | không render nút `Sửa đơn` |

### `/rentals/:id/edit` — sửa (owner)

| State | Condition | Display / action |
| --- | --- | --- |
| staff | me.role ≠ owner | `Navigate` về `/rentals/:id` (display guard; guard BE là luật thật) |
| closed | đơn `returned`/`cancelled` | không hiện form: thông báo "Đơn đã đóng — không sửa được" + nút về chi tiết |
| idle | đơn mở | form tạo đơn DÙNG LẠI (`RentalForm`), prefill: khách, ngày, ghi chú, giảm giá, váy đã chọn với giá = **giá thoả thuận** hiện tại (không phải giá catalog); picker kiểm tra lịch sống nhưng **bỏ qua xung đột của chính đơn này** (lọc `conflicts[].rentalId`), nếu không mọi váy giữ lại đều báo "Vướng lịch" |
| submitting | request đang bay | nút disabled |
| success | 200 | toast "Đã cập nhật lượt thuê"; invalidate list + board + get-rental(id); điều hướng về `/rentals/:id` |
| `rejected_dress_unavailable` / `_retired` / `_not_found` | outcome + `dressIds` | GIỮ form, message form-level + đánh dấu đúng hàng váy (cùng pattern create) |
| `rejected_update_not_allowed` | outcome + `currentStatus` | toast "Không sửa được: đơn đang ở trạng thái X" + invalidate + điều hướng về chi tiết |
| `rejected_rental_not_found` | outcome | toast + invalidate list + điều hướng `/rentals` |
| validation 400 / fault | envelope | toast lỗi chung, giữ form (giảm giá vượt Σ đã bị chặn ở form trước khi gọi API) |
| 403 envelope | staff gọi thẳng API | toast lỗi chung (UI không mời trường hợp này) |

### `/rentals` — list

Tên khách trở thành link tới `/rentals/:id`. Không đổi gì khác.

Accessibility: message từ chối nằm trong `role="alert"` sẵn có của form; nút `Sửa đơn`/`Huỷ`
mang tên khách trong accessible name nếu lặp. Responsive: lưới thông tin 1 cột trên điện thoại,
2–4 cột từ `sm`.

## 4. FE data needs

- Trước command: `GET /rentals/:id` → `RentalDetailDto` = mọi field của `RentalListItemDto`
  + `updatedAt` + `dresses[].blockedUntilDate` + `dresses[].blocking`. Cấu trúc là SIÊU TẬP của
  list item nên `RentalPaymentsDialog`/`RecordCollectionForm` nhận nó nguyên xi.
- Sổ tiền: `GET /rentals/:id/payments` sẵn có (dialog dùng chung).
- Sau command: `IdResponse`; màn chi tiết đọc lại qua invalidate.
- Denormalization: chi tiết = 1 lần load aggregate + 1 `DressLookupPort.findByIds` (không N+1).
- Read side strongly consistent (cùng DB, không projection).

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | PATCH đơn `cancelled` → `rejected_update_not_allowed` + `currentStatus`, DB không đổi | application unit + `test:e2e` |
| AC1 | status không đổi sau update (booked vẫn booked dù ngày nhận = hôm nay) | application unit |
| AC1 | cancel chen vào giữa load và save → cùng outcome, DB giữ `cancelled` | repository (row lock) — e2e bằng cách đóng đơn ngay trước PATCH; race thật khó dựng, luật giống `saveCancelled` |
| AC2 | gia hạn ngày trả trùng đơn khác → `rejected_dress_unavailable` + `dressIds`; gia hạn vào chỗ trống → 200 và `blocked_period` của MỌI item dời theo (kể cả buffer) | unit (pre-check gọi với `excludeRentalId` + kỳ có buffer) + e2e |
| AC2 | race: PATCH (thêm váy X) và POST (đặt váy X) cùng khoảng, bắn đồng thời → đúng một bên thắng, bên thua nhận `rejected_dress_unavailable` | e2e |
| AC2 | raw SQL UPDATE `blocked_period` chồng lên đơn khác → EXCLUDE chặn | e2e |
| AC3 | đổi váy A → B: dòng A xoá, B thêm với giá chuẩn; váy giữ lại giữ id + giá; price gửi lên thắng | unit + e2e |
| AC4 | giảm giá > Σ giá item mới → throw, không save | unit |
| AC5 | staff PATCH → 403 envelope `GENERIC.FORBIDDEN`, DB không đổi | e2e |
| AC6 | GET chi tiết trả `notes`, `discountAmount`, `blockedUntilDate`; id lạ → 404 envelope | e2e |
| — | FE: chi tiết hiện ghi chú + nút `Sửa đơn` cho owner, không cho staff; form sửa prefill và gửi PATCH đúng body (giá váy giữ lại); `rejected_update_not_allowed` → toast + về chi tiết; list link tới chi tiết | vitest |

## 6. Decisions — mặc định agent chốt 2026-09-18 (chủ tiệm bác được từng dòng)

| # | Question | Mặc định | Vì sao | Nếu bác |
| --- | --- | --- | --- | --- |
| 1 | Ai xem được chi tiết đơn? | **Mọi nhân viên** đã đăng nhập; chỉ nút **Sửa đơn** là owner | Read = auth only là bất biến của repo; chi tiết không lộ gì ngoài list (+ ghi chú do chính staff nhập) | thêm `Navigate` theo `me.role` ở route chi tiết + policy đọc ở BE (lần đầu một read có permission) |
| 2 | Sửa được ở trạng thái nào? | **`booked` và `out`**; `returned`/`cancelled` từ chối toàn bộ (kể cả tên/ghi chú) | Đơn đóng đã tất toán — sửa gì cũng là sửa lịch sử | mở riêng tên/ghi chú cho đơn đóng = nhánh riêng trong `update()` |
| 3 | Sửa ngày nhận về ≤ hôm nay có tự chuyển `out` như khi tạo? | **Không** | Sửa không phải giao váy; board vẫn mời "Giao váy" đúng quy trình | thêm `markPickedUp` sau update khi start ≤ shopToday |
| 4 | Váy trên đơn bị retire SAU khi đặt? | **Giữ lại được**; chỉ váy THÊM MỚI bị chặn retired | Sửa số điện thoại không được thất bại vì catalog đổi | áp check retired cho mọi váy |
| 5 | Váy bỏ khỏi đơn: xoá dòng hay giữ `blocking=false`? | **Xoá dòng** | Mọi read liệt kê item bất kể `blocking` → giữ dòng thì list vẫn hiện váy đã bỏ, và UNIQUE (rental_id, dress_id) chặn thêm lại sau này | — |
| 6 | Sửa giá thoả thuận từng váy trên UI? | API nhận `price`; **UI chưa có ô sửa giá** (giữ deferred như form tạo) — váy giữ lại gửi lại đúng giá cũ, váy thêm mới gửi giá catalog đang hiện | Giới hạn scope; API sẵn sàng | thêm ô giá trong `DressPicker` (cả tạo lẫn sửa) |
| 7 | Sổ đã có tiền có chặn sửa không? | **Không** | Sổ ghi thực thu; sửa chỉ đổi số gợi ý; gia hạn sau khi đã cọc là ca thường gặp | thêm guard sổ trống như cancel |
| 8 | Owner-only là guard (403 envelope) hay outcome 403 có tên? | **Guard** `rental:update` = policy owner-only, giống `user:manage`/`dress:retire` | Không có "denial có tên" trong luật — toàn bộ endpoint là của owner | — |
| 9 | Buffer của item sau khi sửa | MỌI item block = kỳ mới + buffer **hiện hành** (kể cả khi chỉ sửa tên) | Một luật, dễ đoán; tiệm đã đổi buffer 2→1 nên đơn cũ sửa xong theo luật mới | chỉ tính lại khi ngày đổi |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| major | Route `GET /rentals/:id` phải đăng ký SAU `GET /rentals/today-board` — Express so khớp theo thứ tự, `ParseUUIDPipe` sẽ 400 `today-board` nếu đứng trước | §4 | controller get-rental đứng CUỐI mảng `controllers` của module + comment |
| major | Picker sửa đơn: availability sống báo "Vướng lịch" cho mọi váy giữ lại vì trùng chính đơn | §3 | lọc `conflicts[].rentalId === rentalId` ở FE (`BookedRangeDto` đã mang `rentalId`) — không đổi BE |
| minor | `rejected_update_not_allowed` là code mới → thêm hàng ADR 0001 §3 + §4 và key vi/en cùng commit | §2 | `rentals:edit.notAllowed` |
| minor | `RentalDetailDto` là siêu tập của `RentalListItemDto` — giữ đúng tên field để dialog tiền dùng chung không cần adapter | §4 | mở rộng bằng `RentalDetailDressDto extends RentalDressDto` |
| minor | Pre-check `findBlockedDressIds` thêm tham số tuỳ chọn `excludeRentalId` — mọi caller cũ giữ nguyên hành vi | §2 bước 6 | optional param |

Mục 1 (naming), 2 (leakage: `notes` đã có trên list từ trước), 5 (read efficiency), 8
(idempotency): không có finding.

## 7. Re-sync as-built (2026-09-18)

Implement khớp spec; các điểm đáng ghi:

1. **`RentalEntity.update()`** là thao tác duy nhất của aggregate được gọi từ command này; nó
   KHÔNG đụng `status`. Reconcile item theo **id** (service ánh xạ váy giữ lại → id cũ + giá cũ,
   váy mới → `nextId()` + giá chuẩn); `RentalItemEntity` thêm `reblock()`/`reprice()`.
2. **`saveUpdated`** = `writeAggregate` với precondition dưới `FOR UPDATE` đọc lại `status`
   (`RentalStateChangedError` → `rejected_update_not_allowed`) — cùng pattern `saveCancelled`;
   dòng item bị bỏ được **DELETE trước khi upsert** (`writeAggregate` xoá các id không còn trong
   aggregate ở mọi đường `save`, các đường cũ không bao giờ bớt item nên là no-op).
3. **`findBlockedDressIds(dressIds, period, { excludeRentalId })`** — tham số tuỳ chọn, caller
   cũ không đổi.
4. FE: `RentalForm` tách khỏi `new-rental-route` (create dùng lại nguyên vẹn, test cũ không đổi);
   `DressPicker` nhận `ignoreRentalId`; route `/rentals/:id` + `/rentals/:id/edit`; list link tên
   khách. MSW thêm `GET/PATCH /rentals/:id`.

| Spec | Code |
| --- | --- |
| R1 | `rental.entity.ts::update` (Err khi không mở); `update-rental.service.spec.ts`; e2e `rental-update.e2e-spec.ts` AC1 |
| R2 | `update-rental.service.ts` (pre-check `excludeRentalId`, race → `DressUnavailableError`); e2e AC2 (gia hạn 422/200, race PATCH-vs-POST, raw UPDATE bị EXCLUDE chặn) |
| R3 | service ánh xạ id/giá; entity reconcile; e2e AC3 |
| R4 | `validate()` gọi lại cuối `update()`; unit AC4 |
| AC5 | `rentals.policies.ts` `rental:update` owner-only; e2e 403 envelope |
| R6 | `queries/get-rental/*` (`RentalDetailDto`); e2e AC6 |
| §3 | `rental-detail-route.tsx`, `edit-rental-route.tsx`, `rental-form.tsx`; vitest `rental-detail.test.tsx` |

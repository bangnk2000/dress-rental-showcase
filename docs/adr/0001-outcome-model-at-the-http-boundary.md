# ADR 0001 — Business outcome sống sót qua HTTP boundary

- **Status:** approved 2026-08-09 (design gate cho `infra/outcome-model`)
- **Bậc:** design-tier — đổi contract cross-context, chạm cả 4 context + 2 client
- **Nguồn quy tắc:** `docs/spec/init-nestjs-hexagonal/06-interface-layer.md` §4–5,
  `07-cross-cutting.md` §Exception Hierarchy + §Global Exception Filter,
  `docs/spec/init-react/04-data-layer.md` §3, `docs/spec/init-feature-spec/01-feature-spec-template.md`
  (định dạng outcome catalog)
- **Đóng:** hai gap từng ghi là `apps/be/AGENTS.md` #6 và `apps/fe/AGENTS.md` #8 (đã xoá khỏi danh
  sách deviation sau khi đóng — chỉ deviation còn hiệu lực mới được đánh số ở đó)

## 1. Bối cảnh

Repo hiện gộp **mọi** từ chối nghiệp vụ vào exception kỹ thuật: `RentalDressNotFoundError` →
404 `GENERIC.NOT_FOUND`, còn `RentalDressRetiredError`, `DressUnavailableError`,
`DressCodeAlreadyExistsError`, `Rental*NotAllowedError` → **cùng** 409 `GENERIC.CONFLICT`. Body là
JSON phẳng `{ message, code, correlationId }`.

Hệ quả đo được:

- FE không phân biệt được "váy đã có người thuê trùng ngày" với "váy đã ngừng cho thuê" — cả hai
  là 409. Ba slice phải tự viết `lib/is-conflict-error.ts` đọc `response.status === 409` rồi hiển
  thị một câu chung; `apps/qr-admin/src/api/error-message.ts` cũng branch theo status.
- Cùng MỘT quy tắc nghiệp vụ trả về hai HTTP khác nhau: pre-check trong
  `create-rental.service.ts` cho 409-qua-`ConflictException`, còn khi race thắng pre-check thì
  EXCLUDE constraint bắn trong `rental.repository.ts` → cũng 409 nhưng message khác.
- `GENERIC.CONFLICT` là đúng mã mà spec cấm dùng cho một rejection.

## 2. Quyết định

**Đúng hai shape trên dây, và global filter là nơi duy nhất render chúng.**

| Shape | Khi nào | HTTP | Body |
| --- | --- | --- | --- |
| **Outcome body** | handler **RETURN** `Result` Err (từ chối nghiệp vụ) | **422**, hoặc **403** cho denial có tên trong catalog | `{ "status": "<snake_case_code>", ...payload }` — filter cho qua nguyên vẹn |
| **Error envelope** | exception được **THROW** (lỗi kỹ thuật/transport) | 400 / 401 / 403 / 404 / 409 / 500 | `{ "error": { code, message, details?, correlationId } }` |

**Đường phân định duy nhất là `returned` vs `thrown`** — không có quy tắc thứ hai:

- `match()` nhánh `Err` trong controller → `BusinessOutcomeException` với code từ catalog §3.
- `throw` (guard, ValidationPipe, value object, query controller không tìm thấy row, bug) → envelope.

Suy ra một cách nhất quán, không cần ngoại lệ đặc biệt:

- `GET /dresses/:id` không có row → **404 envelope** (query controller `throw`).
- `POST /rentals/:id/pickup` với rental không tồn tại → **422 `rejected_rental_not_found`**
  (handler `return Err`) — với nhân viên đứng ở tablet thì "đơn này không còn" là một **kết quả
  nghiệp vụ** cần render trong màn hình, không phải lỗi hạ tầng.
- Login sai mật khẩu → **422 `rejected_invalid_credentials`** (handler `return Err`), KHÔNG phải
  401. 401 chỉ còn nghĩa duy nhất: **guard** chặn vì thiếu/hết hạn token. Nhờ vậy interceptor
  refresh-and-retry ở FE không bao giờ phải đoán ý nghĩa của một 401.
- Race trên EXCLUDE constraint `rental_items_no_overlap`: adapter throw
  `RentalItemsOverlapError` (kỹ thuật, nội bộ), `create-rental.service.ts` bắt và
  `return Err(DressUnavailableError)` → **cùng outcome `rejected_dress_unavailable`** như đường
  pre-check. Một quy tắc nghiệp vụ = một outcome code, dù thắng hay thua race.

**Outcome code là Ubiquitous Language:** snake_case, ổn định sau khi approve — đổi tên là breaking
contract change (FE branch theo nó), phải qua ADR mới.

## 3. Outcome catalog (nguồn duy nhất cho cả hai phía)

Mọi code dưới đây trả **422** trừ khi ghi khác. Payload là field phụ nằm CÙNG cấp với `status` —
FE cần đủ dữ liệu để hành động, không phải GET thêm lần nữa
(`06-interface-layer.md` §4 response-richness).

### identity

| Use case | Domain error (returned) | Outcome code | Payload | FR |
| --- | --- | --- | --- | --- |
| `identity/login` | `InvalidCredentialsError` | `rejected_invalid_credentials` | — | FR-AUTH-01 |
| `identity/login` | `AccountLockedError` | `rejected_account_locked` (chỉ khi mật khẩu ĐÚNG — trạng thái khoá không dò được) | — | FR-AUTH-04 |
| `identity/refresh-token` | `InvalidCredentialsError` | `rejected_invalid_refresh_token` (gộp cả account bị khoá — kênh refresh không giải thích lý do) | — | FR-AUTH-02 |
| `identity/create-user` | `UsernameAlreadyExistsError` | `rejected_username_taken` | `username` (bản lowercase) | FR-AUTH-04 |
| `identity/deactivate-user` | `UserNotFoundError` \| `UserAlreadyInactiveError` \| `CannotDeactivateSelfError` | `rejected_user_not_found` \| `rejected_user_already_inactive` \| `rejected_cannot_deactivate_self` | — | FR-AUTH-04 |
| `identity/reactivate-user` | `UserNotFoundError` \| `UserAlreadyActiveError` | `rejected_user_not_found` \| `rejected_user_already_active` | — | FR-AUTH-04 |
| `identity/reset-password` | `UserNotFoundError` | `rejected_user_not_found` | — | FR-AUTH-04 |

Quyền quản lý user chặn ở guard (`user:manage`, owner-only, fail-closed) → 403 **envelope**
`GENERIC.FORBIDDEN`, không phải outcome — guard chặn TRƯỚC khi use case chạy (§2).

### catalog

| Use case | Domain error (returned) | Outcome code | Payload | FR |
| --- | --- | --- | --- | --- |
| `catalog/create-dress` | `DressCodeAlreadyExistsError` | `rejected_dress_code_taken` | `dressCode` | FR-CAT-01, 03 |
| `catalog/update-dress` | `DressNotFoundError` | `rejected_dress_not_found` | — | FR-CAT-03 |
| `catalog/update-dress` | `DressCodeAlreadyExistsError` | `rejected_dress_code_taken` | `dressCode` | FR-CAT-01, 03 |
| `catalog/retire-dress` | `DressNotFoundError` | `rejected_dress_not_found` | — | FR-CAT-03 |
| `catalog/retire-dress` | `DressAlreadyRetiredError` | `rejected_dress_already_retired` | — | FR-CAT-03 |

### rentals

| Use case | Domain error (returned) | Outcome code | Payload | FR |
| --- | --- | --- | --- | --- |
| `rentals/create-rental` | `RentalDressNotFoundError` | `rejected_dress_not_found` | `dressIds[]` | FR-RENT-01 |
| `rentals/create-rental` | `RentalDressRetiredError` | `rejected_dress_retired` | `dressIds[]` | FR-RENT-01, FR-CAT-03 |
| `rentals/create-rental` | `DressUnavailableError` | `rejected_dress_unavailable` | `dressIds[]` | FR-RENT-02, BR-1 |
| `rentals/pickup-rental` | `RentalNotFoundError` | `rejected_rental_not_found` | — | FR-RENT-04 |
| `rentals/pickup-rental` | `RentalPickupNotAllowedError` | `rejected_pickup_not_allowed` | `currentStatus` | FR-RENT-04, BR-3 |
| `rentals/return-rental` | `RentalNotFoundError` | `rejected_rental_not_found` | — | FR-RENT-05 |
| `rentals/return-rental` | `RentalReturnNotAllowedError` | `rejected_return_not_allowed` (từ FR-RENT-10 gồm cả `booked` — chưa giao thì chưa nhận về) | `currentStatus` | FR-RENT-05, FR-RENT-10, BR-3 |
| `rentals/return-rental` | `LateFeeWaiverNotAllowedError` | `forbidden` (**403**) + `reason: 'late_fee_waiver_requires_owner'` | `suggestedLateFee`, `submittedLateFee` | FR-RENT-09 |
| `rentals/return-rental` | `LateFeeWaiverNoteRequiredError` | `rejected_waiver_note_required` | `suggestedLateFee`, `submittedLateFee` | FR-RENT-09 |
| `rentals/return-rental` | `ReturnDepositBasisChangedError` | `rejected_deposit_basis_changed` | `collectedDeposit` | FR-PAY-02 |
| `rentals/cancel-rental` | `RentalNotFoundError` | `rejected_rental_not_found` | — | FR-RENT-06 |
| `rentals/cancel-rental` | `RentalCancelNotAllowedError` | `rejected_cancel_not_allowed` (từ FR-RENT-10 chỉ còn `returned`/`cancelled` — đơn `out` sổ trống được huỷ) | `currentStatus` | FR-RENT-06, FR-RENT-10, BR-3 |
| `rentals/cancel-rental` | `RentalCancelHasPaymentsError` | `rejected_cancel_has_payments` — sổ có tiền thì lối ra duy nhất là return | — | FR-RENT-10 |

### payments

| Use case | Domain error (returned) | Outcome code | Payload | FR |
| --- | --- | --- | --- | --- |
| `payments/record-collection` | `CollectionRentalNotFoundError` | `rejected_rental_not_found` | — | FR-PAY-02 |
| `payments/record-collection` | `RentalClosedError` | `rejected_rental_closed` | `currentStatus` (`returned`\|`cancelled`) | FR-PAY-02, BR-3 |
| `payments/record-collection` | `NothingToRecordError` | `rejected_nothing_to_record` | — | FR-PAY-02 |
| `payments/record-collection` | `CollectionAlreadyRecordedError` (kind `deposit`) | `rejected_deposit_already_recorded` | `recordedAmount` | FR-PAY-02, BR-7 |
| `payments/record-collection` | `CollectionAlreadyRecordedError` (kind `rental_fee`) | `rejected_rental_fee_already_recorded` | `recordedAmount` | FR-PAY-02, BR-7 |

**Luật race (áp dụng cho MỌI precondition có ràng buộc DB đứng sau):** pre-check ở service và ràng
buộc ở DB là HAI NGƯỜI GÁC CÙNG MỘT LUẬT, nên client không được phép phân biệt ai bắt. Adapter dịch
lỗi ràng buộc thành exception của port (`RentalItemsOverlapError`, `DressCodeConflictError`), service
bắt lại và trả **đúng outcome mà pre-check sẽ trả**. Không làm vậy thì cùng một nghiệp vụ lúc ra 422
outcome (form hiện field error), lúc ra 409 envelope (form chỉ còn toast chung) — tuỳ vào việc có ai
chen ngang hay không. Mỗi luật loại này phải có một ca `test:e2e` bắn hai request đồng thời.

`dressIds[]` là các váy VI PHẠM (không phải toàn bộ giỏ) — metadata đã có sẵn trong domain error
(`create-rental.service.ts` truyền `{ dressIds }`). `currentStatus` cho FE nói được "đơn đang ở
trạng thái X" và refresh đúng bảng.

Bổ sung 2026-08-10 (FR-RENT-09, spec [rentals/settle-late-fee.md](../design/rentals/settle-late-fee.md)):
hai mã cuối bảng là **outcome 403 có tên đầu tiên** của repo và mã đi kèm nó. Chúng chứng minh luật
arbitration ở §2 hoạt động: `PoliciesGuard` chặn `rental:return` thì vẫn là 403 **envelope**, còn
"staff không được giảm phí" là denial nằm trong spec nên là 403 **outcome body**.

Bổ sung 2026-08-10 (FR-PAY-02, spec [payments/record-collection.md](../design/payments/record-collection.md)):
`rejected_*_already_recorded` là mã đầu tiên được sinh ra từ **hai nguồn**: pre-check của service
VÀ partial UNIQUE index khi thua race. Cùng một luật thì cùng một mã (§2) — repository dịch lỗi
UNIQUE thành `CollectionConflictError`, service đọc lại sổ rồi trả đúng outcome kèm số đang có.
`rejected_nothing_to_record` là ranh giới ngược lại: từng field hợp lệ khi đứng riêng, cái sai nằm
ở mức use case, nên nó là outcome chứ không phải 400.

### Không có outcome (cố ý)

- `qr/create-url-code`: `Result<QrLinkEntity, never>` — URL sai là **input invalid**, do value
  object `TargetUrl` throw → **400 envelope** `GENERIC.ARGUMENT_INVALID`. Đừng tạo outcome cho nó.
- Mọi query slice (`list-*`, `get-*`, `check-availability`, `list-payments`): không có từ chối
  nghiệp vụ; không tìm thấy row → **404 envelope**.
- Denial của `PoliciesGuard` (permission chưa đăng ký / role sai) → **403 envelope**
  `GENERIC.FORBIDDEN`. Repo này chưa có denial nghiệp vụ có tên nào (kiểu "không phải chủ đơn"),
  nên **chưa** có outcome 403 nào. Khi có, nó là `{ status: 'forbidden', reason }` (403).

## 4. UI state matrix (FE + qr-admin)

Rejection render **tại chỗ**, không bao giờ ném ra error boundary. Fault mới đi boundary, và chỉ
với query (`throwOnError: isServerOrNetworkError`); fault của mutation render local kèm retry.

| Outcome code | apps/fe — state được thiết kế | i18n key |
| --- | --- | --- |
| `rejected_invalid_credentials` | giữ form login, message dưới field password | `auth:errors.invalidCredentials` |
| `rejected_account_locked` | giữ form login, message riêng "đã bị khoá — hỏi chủ tiệm" | `auth:errors.accountLocked` |
| `rejected_invalid_refresh_token` | không hiển thị: mutator xoá session → điều hướng `/sign-in` | — |
| `rejected_username_taken` | giữ dialog tạo user, field error trên `username` | `users:validation.usernameTaken` |
| `rejected_user_already_inactive` / `_already_active` | toast "trạng thái đã đổi trên thiết bị khác" + refetch list | `users:actions.staleState` |
| `rejected_user_not_found` / `rejected_cannot_deactivate_self` | toast chung + refetch (UI không mời hai case này: hàng của mình không có nút khoá) | `users:actions.staleState` |
| `rejected_dress_code_taken` | giữ dialog, field error trên `code`, kèm `dressCode` | `dresses:form.errors.codeTaken` |
| `rejected_dress_not_found` (catalog) | đóng dialog + toast "váy không còn", invalidate list | `dresses:errors.notFound` |
| `rejected_dress_already_retired` | toast + invalidate detail (state đã đúng, chỉ lệch cache) | `dresses:detail.retire.alreadyRetired` |
| `rejected_dress_not_found` (rentals) | giữ form, message form-level liệt kê `dressIds` | `rentals:form.errors.dressNotFound` |
| `rejected_dress_retired` | giữ form, message form-level + gợi ý bỏ váy đó | `rentals:form.errors.dressRetired` |
| `rejected_dress_unavailable` | giữ form, message form-level "trùng lịch (gồm đệm giặt)" | `rentals:form.errors.dressUnavailable` |
| `rejected_rental_not_found` | toast + invalidate board/list (đơn đã bị người khác xử lý) | `rentals:errors.rentalNotFound` / `today:errors.rentalNotFound` |
| `rejected_pickup_not_allowed` | toast nêu `currentStatus` + invalidate board | `today:errors.pickupNotAllowed` |
| `rejected_return_not_allowed` | đóng dialog, toast nêu `currentStatus` + invalidate; `currentStatus='booked'` có câu RIÊNG chỉ việc ("giao trước khi nhận về") | `today:errors.returnNotAllowed` / `today:errors.returnNotPickedUp` |
| `forbidden` (`late_fee_waiver_requires_owner`) | GIỮ dialog, field error dưới phí trễ; số đề xuất vẫn hiển thị ở banner phía trên (message form là i18n key, không nội suy tham số) | `today:errors.lateFeeWaiverForbidden` |
| `rejected_waiver_note_required` | GIỮ dialog, focus field Ghi chú + message bắt buộc lý do | `today:errors.waiverNoteRequired` |
| `rejected_cancel_not_allowed` | toast nêu `currentStatus` + invalidate list/board | `rentals:cancel.notAllowed` / `today:cancel.notAllowed` |
| `rejected_cancel_has_payments` | toast "sổ đã có tiền — đi đường return" + invalidate | `rentals:cancel.hasPayments` / `today:cancel.hasPayments` |
| `rejected_deposit_already_recorded` / `rejected_rental_fee_already_recorded` | GIỮ dialog, field error trên ô tương ứng + invalidate sổ của đơn (danh sách phía trên hiện ngay dòng đã có) | `rentals:collect.errors.alreadyRecorded` |
| `rejected_nothing_to_record` | message trên ô Tiền cọc; thực tế nút đã disabled khi cả hai ô trống | `rentals:collect.errors.nothingToRecord` |
| `rejected_rental_closed` | đóng dialog, toast nêu `currentStatus` + invalidate list | `rentals:collect.rentalClosed` |
| `rejected_deposit_basis_changed` | GIỮ dialog: tính lại hoàn cọc theo `collectedDeposit` server trả về, toast nêu số mới, invalidate sổ của đơn | `today:returnDialog.deposit.changed` |
| *fault* `GENERIC.VALIDATION` (400 + `details[]`) | `form.setError` theo `details[].field` | (message từ server) |
| *fault* còn lại trên mutation | toast lỗi chung + cho bấm lại | `common:errors.generic` |
| *fault* còn lại trên query | route error boundary | — |

`apps/qr-admin` dùng cùng seam: `rejected_invalid_credentials` → message ở form login; 403 envelope
→ "tài khoản không có quyền QR Admin"; 400 envelope → message URL sai; còn lại → lỗi chung.

## 5. Hệ quả

- **Breaking change có chủ ý** với client cũ: 409/404/401 của các use case ở §3 thành 422. Cả hai
  client trong repo được sinh lại và sửa cùng commit (invariant "contract một chiều"), nên không
  có consumer nào ngoài tầm — đây chính là lý do monorepo tồn tại.
- `libs/exceptions` bỏ `ConflictException` khỏi mọi controller; nó chỉ còn dùng cho vi phạm ràng
  buộc DB **không** thuộc một quy tắc nghiệp vụ đã đặt tên.
- Envelope thêm một lớp `error` → `apps/fe/src/api/errors.ts` là nơi DUY NHẤT đọc shape; ba file
  `lib/is-conflict-error.ts` bị xoá, không thay bằng helper khác.
- `Idempotency-Key` **chưa** làm trong ADR này (không client nào gửi, không endpoint nào honor).
  Double-submit hiện được chặn bằng EXCLUDE constraint ở DB. Ghi lại như giới hạn đã biết, sẽ là
  ADR riêng khi có nhu cầu thật.
- `correlationId` vẫn lấy từ header `x-request-id` trong filter (repo chưa có AsyncLocalStorage
  request-context như `07-cross-cutting.md` §Observability mô tả). Envelope vẫn đúng shape; nâng
  lên request-context là việc riêng, không chặn ADR này.

## 6. Phương án đã cân nhắc và loại

| Phương án | Vì sao loại |
| --- | --- |
| Giữ 409, thêm mã máy riêng trong body phẳng (`RENTALS.DRESS_UNAVAILABLE`) | Vẫn là shape thứ ba trên dây, spec cấm; FE vẫn phải đọc status trước rồi mới đọc code |
| Chỉ đổi rentals, để catalog/identity sau | Hai shape song song trong cùng contract = FE phải giữ cả `is-conflict-error.ts` lẫn `mapApiError`; đúng cái nửa vời mà AGENTS ghi là MUST NOT |
| Dùng 400 cho rejection | 400 dành cho input không hợp lệ (`details[]` theo field); trộn vào sẽ mất khả năng map field error |

## 7. Re-sync

as-built 2026-08-09 — implement khớp quyết định trên. Nếu về sau một use case thêm outcome, cập
nhật §3 + §4 **trước** khi code, và ghi vào design doc của context tương ứng.

# SRS — Ứng dụng quản lý tiệm cho thuê váy (dress-rental)

> **Status: as-built v1.0 (2026-08-02).** Viết NGƯỢC từ code + `feature_list.json` sau khi MVP
> hoàn tất (13/13 pass) — đóng vai trò intent doc chuẩn cho các phase sau. Nguồn chuẩn về hành
> vi hiện tại là code + `packages/contract/openapi.json`; tài liệu này ghi **yêu cầu, lý do, và
> bảng truy vết FR ↔ feature**. Quy trình đi từ SRS này ra feature/task: xem
> [design/README.md](./design/README.md) §Quy trình.

## 1. Tổng quan

Ứng dụng quản lý nội bộ cho tiệm cho thuê váy (~200 váy), thay thế quy trình Google Sheets.
Staff-facing, tiếng Việt là ngôn ngữ chính (en phụ), PWA để nhân viên cài trên tablet/điện thoại
của tiệm. Trang marketing công khai (WordPress/Haravan) **ngoài phạm vi** repo này.

Bốn bounded context: `identity` (đăng nhập/quyền), `catalog` (danh mục váy), `rentals`
(đặt–lấy–trả–hủy + lịch + bảng hôm nay), `payments` (dòng tiền của đơn thuê).

## 2. Người dùng & vai trò

| Vai trò | Quyền |
| --- | --- |
| `staff` | Toàn bộ nghiệp vụ hằng ngày: danh mục, tạo/lấy/trả/hủy đơn, xem tiền |
| `owner` | Như staff + các hành động rủi ro cao: **retire váy**, **miễn giảm phí trễ**, **quản lý tài khoản** (owner-only) |

AuthZ là ABAC **fail-closed** (permission chưa đăng ký = DENY) — `libs/authz`.

## 3. Yêu cầu chức năng (FR)

### identity
- **FR-AUTH-01** Đăng nhập **username**/password → access + refresh token (2 secret riêng).
  (Đổi từ email 2026-08-10 — [manage-users](./design/identity/manage-users.md) §6.Q1: staff
  không có email công việc, một cột định danh là một sự thật.)
- **FR-AUTH-02** Refresh token. Sai mật khẩu / refresh token không hợp lệ là **outcome nghiệp vụ**
  (`rejected_invalid_credentials` / `rejected_invalid_refresh_token`, 422 — [ADR
  0001](./adr/0001-outcome-model-at-the-http-boundary.md)), FE không retry. **401 chỉ còn một
  nghĩa**: guard chặn vì thiếu/hết hạn access token → refresh-and-retry một lần. Refresh của
  account bị khoá chết như token hỏng — lý do là việc của login.
- **FR-AUTH-03** Xem hồ sơ đang đăng nhập (`GET /auth/me`).
- **FR-AUTH-04** Owner quản lý tài khoản: tạo staff (username duy nhất case-insensitive,
  password ≥ 8), **khoá/mở** (không xoá — FK lịch sử trỏ tới user vĩnh viễn), đặt lại mật khẩu
  tại quầy. Đăng nhập đúng mật khẩu vào account khoá → `rejected_account_locked` (nêu rõ);
  sai mật khẩu luôn là `rejected_invalid_credentials` (không dò được trạng thái khoá).
  Owner không tự khoá được chính mình. Access token đang sống chạy hết TTL (trade-off nêu rõ).

### catalog
- **FR-CAT-01** Váy có: mã **duy nhất**, giá thuê, tiền cọc chuẩn, link ảnh (`photo_urls`),
  trạng thái `active | retired`. "Đang thuê / đang vệ sinh" là trạng thái **suy diễn** từ
  rentals — không phải cột status (BR-5).
- **FR-CAT-02** List/search váy (mã, size, trạng thái) + xem chi tiết.
- **FR-CAT-03** Tạo / cập nhật váy; **retire** (owner-only) — váy retired không tạo đơn mới,
  lịch sử giữ nguyên.
- **FR-CAT-04** Seed một lần từ CSV xuất Google Sheets (~200 váy) — `pnpm --filter be import:dresses`.

### rentals
- **FR-RENT-01** Tạo đơn thuê: khách (tên/điện thoại) + NHIỀU váy + khoảng ngày **inclusive**
  `[start, end]`; mỗi váy bị block thêm **buffer vệ sinh** (`CLEANING_BUFFER_DAYS`) sau ngày trả.
- **FR-RENT-02** Chống trùng lịch: một váy không thể có hai khoảng block giao nhau (kể cả
  buffer) — **enforce ở tầng DB** bằng EXCLUDE constraint; app chỉ pre-check để báo lỗi đẹp
  (BR-1). Race giữa hai request đồng thời phải bị DB chặn, và **cả hai đường (pre-check lẫn
  race) trả cùng một outcome** `rejected_dress_unavailable` (422) kèm `dressIds` — một quy tắc
  nghiệp vụ chỉ có một mã trên dây ([ADR 0001](./adr/0001-outcome-model-at-the-http-boundary.md)).
- **FR-RENT-03** Availability: trả lời "váy X có trống từ A đến B không"; chi tiết váy hiển thị
  các khoảng đã đặt trên lịch.
- **FR-RENT-04** Pickup: đơn `booked` → `out` khi khách lấy váy.
- **FR-RENT-05** Return + settle: đơn `out` → `returned` (**CHỈ từ `out`** — FR-RENT-10 bỏ
  lối tắt booked→returned); ghi các dòng tiền `deposit_refund` / `late_fee` / `damage_fee`
  (+ ghi chú) vào `payments`. Váy tiếp tục bị block hết buffer (= "đang vệ sinh"), sau đó tự do.
- **FR-RENT-06** Cancel: đơn `booked` — hoặc `out` với **sổ tiền TRỐNG** (FR-RENT-10 §6.Q2) —
  → `cancelled`; items chuyển `blocking=false` — **giải phóng lịch, giữ lịch sử**. Sổ có tiền
  → `rejected_cancel_has_payments`: lối ra duy nhất là return.
- **FR-RENT-07** Bảng "Hôm nay": váy phải giao hôm nay (due out), phải nhận về hôm nay
  (due back), và **OVERDUE** — màn hình nhân viên mở mỗi sáng, có nút thao tác trực tiếp.
- **FR-RENT-08** Danh sách đơn: search tên/điện thoại khách, filter status, phân trang;
  mang action cancel (hàng booked) và dialog payments (hàng returned).
- **FR-RENT-09** Phí trễ hạn **tự tính**: `số ngày trễ × số váy × 200.000₫` (đơn giá cố định ở env
  `LATE_FEE_PER_DRESS_PER_DAY`; đệm giặt KHÔNG tính là trễ). Dialog tất toán đọc số này từ
  `GET /rentals/:id/late-fee` và pre-fill để nhân viên nói với khách trước khi xác nhận. Thu **ít
  hơn** số đề xuất chỉ chủ tiệm được làm và **phải ghi lý do**; thu nhiều hơn thì tự do. Quyết định
  + lý do: [design/rentals/settle-late-fee.md](./design/rentals/settle-late-fee.md) §6.
- **FR-RENT-10** Trạng thái đơn phản ánh váy đang ở đâu: (a) **chưa giao thì chưa nhận về** —
  return chỉ hợp lệ từ `out`; (b) đơn tạo với ngày nhận là **hôm nay hoặc đã qua** (giờ tiệm,
  `Asia/Ho_Chi_Minh`) sinh ra ở trạng thái `out` — khách đang ở quầy hoặc là nhập bù; (c) đơn
  `booked` trên due-back/overdue là khách chưa lấy — board mời giao trễ hoặc huỷ. Quyết định +
  lý do: [design/rentals/pickup-before-return.md](./design/rentals/pickup-before-return.md) §6.

### payments
- **FR-PAY-01** Xem các dòng tiền của một đơn (`GET /rentals/:id/payments`), kèm `summary` cộng
  sẵn theo từng kind. Write side của TẤT TOÁN nằm trong return flow của rentals qua
  `PaymentRecorderPort` — quyết định thiết kế, xem
  [design/payments-aggregate.md](./design/payments-aggregate.md).
- **FR-PAY-02** Ghi nhận **tiền đã thu** của một đơn: tiền cọc và/hoặc tiền thuê, bằng một hành
  động đứng riêng dùng được bất cứ lúc nào khi đơn còn MỞ (`booked|out`). Gợi ý số tiền từ Σ cọc
  chuẩn và Σ giá thoả thuận, nhân viên sửa được; sổ ghi số **thực thu**. Mỗi đơn tối đa MỘT dòng
  cọc và MỘT dòng tiền thuê (chặn ở DB). Kể từ đây, hoàn cọc lúc trả váy tính trên **cọc đã thu**;
  cọc chuẩn chỉ là số tham chiếu khi đơn chưa ghi nhận cọc. Quyết định + lý do:
  [design/payments/record-collection.md](./design/payments/record-collection.md) §6.

## 4. Business rules (BR — bảng enforce chi tiết nằm trong design docs)

| # | Rule | Enforce |
| --- | --- | --- |
| BR-1 | Một váy không bị đặt trùng khoảng thời gian, tính cả buffer vệ sinh | DB `EXCLUDE USING gist` (+ proof test trên Postgres thật) + pre-check → outcome `rejected_dress_unavailable` (422) |
| BR-2 | Một váy không xuất hiện hai lần trong cùng một đơn | DTO `@ArrayUnique` + entity `validate()` + DB `UNIQUE (rental_id, dress_id)` |
| BR-3 | Vòng đời đơn: `booked → out → returned`; `booked → cancelled`; không đường nào khác | State machine trong `RentalEntity` + DB CHECK status |
| BR-4 | Tiền là VND integer ≥ 0 (không thập phân) | `Money` VO + DB CHECK |
| BR-5 | "Đang vệ sinh" = váy còn trong buffer sau return; KHÔNG phải cột status | Suy diễn từ `blocked_period` |
| BR-6 | Settlement ghi SAU khi flip status returned; nếu ghi lỗi thì nhập tay lại | Trade-off MVP có chủ ý (comment trong `return-rental.service.ts`) |
| BR-7 | Mỗi đơn tối đa MỘT dòng `deposit` và MỘT dòng `rental_fee`; chỉ ghi được khi đơn còn mở | Partial `UNIQUE INDEX` trên `payments` (+ proof test trên Postgres thật) + pre-check → outcome `rejected_*_already_recorded` / `rejected_rental_closed` (422) |

## 5. Yêu cầu phi chức năng (NFR)

- **NFR-01** vi là ngôn ngữ chính, en phụ; message lỗi form là i18n key.
- **NFR-02** PWA cài được trên thiết bị của tiệm; API NetworkOnly.
- **NFR-03** FE + BE ship như MỘT unit cùng origin ở prod (không CORS).
- **NFR-04** Quy mô nhỏ: ~200 váy, vài người dùng đồng thời — không tối ưu sớm (YAGNI).
- **NFR-05** Contract một chiều BE → openapi → FE, drift gate trong CI (bất biến #1 của repo).

## 6. Ngoài phạm vi (đến khi có quyết định khác)

Trang marketing / khách tự đặt online · quản lý kho ngoài váy · báo cáo doanh thu/thống kê
(candidate trong session-handoff) · multi-tenant/nhiều chi nhánh · thông báo (event đã phát
nhưng chưa có consumer — chỉ bật khi có nhu cầu thật, spec 01 §8).

## 7. Bảng truy vết FR ↔ feature ↔ design

| FR | Feature (`feature_list.json`) | Design doc | Trạng thái |
| --- | --- | --- | --- |
| FR-AUTH-01..03 | `infra/be-bootstrap` (identity ship cùng bootstrap) | [identity-aggregate.md](./design/identity-aggregate.md) | pass |
| FR-AUTH-04, FR-AUTH-01 (đổi định danh) | `identity/manage-users` | [identity/manage-users.md](./design/identity/manage-users.md) (spec `as-built`), [identity-aggregate.md](./design/identity-aggregate.md) | pass |
| FR-CAT-01, 02, 04 | `catalog/list-dresses` | [catalog-aggregate.md](./design/catalog-aggregate.md) | pass |
| FR-CAT-01, 03 | `catalog/manage-dress` | [catalog-aggregate.md](./design/catalog-aggregate.md) | pass |
| FR-RENT-01, 02 | `rentals/create-rental` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-03 | `rentals/availability-check` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-04, 07 | `rentals/today-board` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-05 | `rentals/return-rental` | [rentals-aggregate.md](./design/rentals-aggregate.md), [payments-aggregate.md](./design/payments-aggregate.md) | pass |
| FR-RENT-06 | `rentals/cancel-rental` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-08 | `rentals/list-rentals` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-PAY-01 | `payments/list-payments` | [payments-aggregate.md](./design/payments-aggregate.md) | pass |
| FR-PAY-02 | `payments/record-collection` | [payments/record-collection.md](./design/payments/record-collection.md) (spec `as-built`), [payments-aggregate.md](./design/payments-aggregate.md) | pass |
| FR-RENT-09 | `rentals/settle-late-fee` | [rentals/settle-late-fee.md](./design/rentals/settle-late-fee.md) (spec `as-built`), [rentals-aggregate.md](./design/rentals-aggregate.md) §Phí trễ hạn | pass |
| FR-RENT-10 (siết FR-RENT-05, nới FR-RENT-06) | `rentals/pickup-before-return` | [rentals/pickup-before-return.md](./design/rentals/pickup-before-return.md) (spec `as-built`), [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| (hạ tầng) | `infra/monorepo-skeleton`, `infra/fe-bootstrap`, `infra/e2e-playwright` | — | pass |

Quy tắc duy trì bảng này: **mỗi FR mới thêm vào SRS phải có hàng ở đây trước khi feature được
promote lên `in-progress`** — xem quy trình ở [design/README.md](./design/README.md).

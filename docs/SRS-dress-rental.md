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
| `owner` | Như staff + các hành động rủi ro cao: **retire váy** (owner-only) |

AuthZ là ABAC **fail-closed** (permission chưa đăng ký = DENY) — `libs/authz`.

## 3. Yêu cầu chức năng (FR)

### identity
- **FR-AUTH-01** Đăng nhập email/password → access + refresh token (2 secret riêng).
- **FR-AUTH-02** Refresh token. Sai mật khẩu / refresh token không hợp lệ là **outcome nghiệp vụ**
  (`rejected_invalid_credentials` / `rejected_invalid_refresh_token`, 422 — [ADR
  0001](./adr/0001-outcome-model-at-the-http-boundary.md)), FE không retry. **401 chỉ còn một
  nghĩa**: guard chặn vì thiếu/hết hạn access token → refresh-and-retry một lần.
- **FR-AUTH-03** Xem hồ sơ đang đăng nhập (`GET /auth/me`).

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
- **FR-RENT-05** Return + settle: đơn `booked|out` → `returned`; ghi các dòng tiền
  `deposit_refund` / `late_fee` / `damage_fee` (+ ghi chú) vào `payments`. Váy tiếp tục bị
  block hết buffer (= "đang vệ sinh"), sau đó tự do.
- **FR-RENT-06** Cancel: đơn `booked` → `cancelled`; items chuyển `blocking=false` — **giải
  phóng lịch, giữ lịch sử**.
- **FR-RENT-07** Bảng "Hôm nay": váy phải giao hôm nay (due out), phải nhận về hôm nay
  (due back), và **OVERDUE** — màn hình nhân viên mở mỗi sáng, có nút thao tác trực tiếp.
- **FR-RENT-08** Danh sách đơn: search tên/điện thoại khách, filter status, phân trang;
  mang action cancel (hàng booked) và dialog payments (hàng returned).
- **FR-RENT-09** Phí trễ hạn **tự tính**: `số ngày trễ × số váy × 200.000₫` (đơn giá cố định ở env
  `LATE_FEE_PER_DRESS_PER_DAY`; đệm giặt KHÔNG tính là trễ). Dialog tất toán đọc số này từ
  `GET /rentals/:id/late-fee` và pre-fill để nhân viên nói với khách trước khi xác nhận. Thu **ít
  hơn** số đề xuất chỉ chủ tiệm được làm và **phải ghi lý do**; thu nhiều hơn thì tự do. Quyết định
  + lý do: [design/rentals/settle-late-fee.md](./design/rentals/settle-late-fee.md) §6.

### payments
- **FR-PAY-01** Xem các dòng tiền của một đơn (`GET /rentals/:id/payments`). Write side nằm
  trong return flow của rentals qua `PaymentRecorderPort` — quyết định thiết kế, xem
  [design/payments-aggregate.md](./design/payments-aggregate.md).

## 4. Business rules (BR — bảng enforce chi tiết nằm trong design docs)

| # | Rule | Enforce |
| --- | --- | --- |
| BR-1 | Một váy không bị đặt trùng khoảng thời gian, tính cả buffer vệ sinh | DB `EXCLUDE USING gist` (+ proof test trên Postgres thật) + pre-check → outcome `rejected_dress_unavailable` (422) |
| BR-2 | Một váy không xuất hiện hai lần trong cùng một đơn | DTO `@ArrayUnique` + entity `validate()` + DB `UNIQUE (rental_id, dress_id)` |
| BR-3 | Vòng đời đơn: `booked → out → returned`; `booked → cancelled`; không đường nào khác | State machine trong `RentalEntity` + DB CHECK status |
| BR-4 | Tiền là VND integer ≥ 0 (không thập phân) | `Money` VO + DB CHECK |
| BR-5 | "Đang vệ sinh" = váy còn trong buffer sau return; KHÔNG phải cột status | Suy diễn từ `blocked_period` |
| BR-6 | Settlement ghi SAU khi flip status returned; nếu ghi lỗi thì nhập tay lại | Trade-off MVP có chủ ý (comment trong `return-rental.service.ts`) |

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
| FR-CAT-01, 02, 04 | `catalog/list-dresses` | [catalog-aggregate.md](./design/catalog-aggregate.md) | pass |
| FR-CAT-01, 03 | `catalog/manage-dress` | [catalog-aggregate.md](./design/catalog-aggregate.md) | pass |
| FR-RENT-01, 02 | `rentals/create-rental` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-03 | `rentals/availability-check` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-04, 07 | `rentals/today-board` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-05 | `rentals/return-rental` | [rentals-aggregate.md](./design/rentals-aggregate.md), [payments-aggregate.md](./design/payments-aggregate.md) | pass |
| FR-RENT-06 | `rentals/cancel-rental` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-RENT-08 | `rentals/list-rentals` | [rentals-aggregate.md](./design/rentals-aggregate.md) | pass |
| FR-PAY-01 | `payments/list-payments` | [payments-aggregate.md](./design/payments-aggregate.md) | pass |
| FR-RENT-09 | `rentals/settle-late-fee` | [rentals/settle-late-fee.md](./design/rentals/settle-late-fee.md) (spec `as-built`), [rentals-aggregate.md](./design/rentals-aggregate.md) §Phí trễ hạn | pass |
| (hạ tầng) | `infra/monorepo-skeleton`, `infra/fe-bootstrap`, `infra/e2e-playwright` | — | pass |

Quy tắc duy trì bảng này: **mỗi FR mới thêm vào SRS phải có hàng ở đây trước khi feature được
promote lên `in-progress`** — xem quy trình ở [design/README.md](./design/README.md).

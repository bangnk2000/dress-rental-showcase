# SRS — QR URL Admin (phase ship-first)

> **Status: approved 2026-08-04.** Đây là phase độc lập, được ưu tiên ship trước các backlog khác.
> Quyết định thiết kế chi tiết nằm ở [design/qr-aggregate.md](./design/qr-aggregate.md) và
> [design/qr-admin.md](./design/qr-admin.md). Bootstrap app được triển khai trước API/UI slice.

## 1. Mục tiêu và ranh giới

Tạo một công cụ nội bộ thật nhỏ để owner nhập một URL, nhận preview QR và tải file SVG để in hoặc
chia sẻ. Công cụ gồm một bounded context `qr` trong `apps/be` và một admin SPA mới ở
`apps/qr-admin/`; nó **không** là một feature hay thư mục con của `apps/fe` hiện hữu.

QR ở MVP mã hoá chính URL đích. Hệ thống không chuyển hướng, không đếm lượt quét và không gọi/fetch
URL đó từ server. Vì vậy nó không là URL shortener hay tracker.

## 2. Người dùng và phân quyền

| Vai trò | Quyền |
| --- | --- |
| `owner` | Tạo, xem danh sách, xem chi tiết và tải QR SVG |
| `staff` | Không truy cập QR admin/API (403) |
| chưa đăng nhập | Không truy cập QR admin/API (401) |

Admin dùng JWT bearer + refresh flow đang có ở `identity`; không thêm hệ auth thứ hai.

## 3. Functional requirements

- **FR-QR-01** Owner tạo QR từ một URL đích tuyệt đối `https://` hoặc `http://`, dài tối đa
  2.048 ký tự, với nhãn nội bộ tuỳ chọn dài tối đa 120 ký tự.
- **FR-QR-02** Hệ thống lưu một bản ghi bất biến gồm URL, nhãn, owner tạo và thời điểm tạo; tạo
  thành công trả về `id`, metadata và URL của ảnh SVG.
- **FR-QR-03** Owner xem danh sách QR mới nhất trước, phân trang; mỗi hàng có nhãn/URL rút gọn,
  người tạo và thời điểm tạo.
- **FR-QR-04** Owner xem QR SVG qua endpoint xác thực và tải SVG đó. SVG phải mã hoá chính xác
  `targetUrl` đã lưu, không phải một redirect URL của hệ thống.
- **FR-QR-05** Admin tối giản có một màn hình: form tạo ở trên, preview QR + tải SVG sau khi tạo,
  và danh sách lịch sử bên dưới. Refresh trang vẫn thấy lịch sử.

## 4. Business rules

| ID | Rule | Enforcement |
| --- | --- | --- |
| **BR-QR-01** | Chỉ nhận URL tuyệt đối `http(s)`; cấm `javascript:`, `data:`, URL tương đối và credentials trong URL | DTO + `URL` parser trong domain/application; 400 |
| **BR-QR-02** | Tạo QR không được làm server gọi URL bên ngoài | Không có HTTP client/fetch trong module `qr`; unit test/architecture review |
| **BR-QR-03** | Chỉ owner được thao tác QR | `qr:*` policies fail-closed, JWT + `PoliciesGuard`; 401/403 |
| **BR-QR-04** | Bản ghi QR không sửa hoặc xoá trong MVP | Không có update/delete endpoint; DB chỉ cho create/read từ app role |
| **BR-QR-05** | SVG được tạo quyết định từ URL đã lưu và được trả với `image/svg+xml` | `QrRendererPort` + adapter thư viện QR; controller test content type/body |

Không có critical uniqueness/overlap/capacity invariant trong phase này, nên không thêm DB constraint
chỉ để thay thế một application check. `target_url` vẫn là `NOT NULL`; `created_by_staff_id` là FK
để không tạo orphan record.

## 5. Non-functional requirements

- **NFR-QR-01** Contract một chiều: BE DTO/controller → `pnpm openapi:emit` →
  `packages/contract/openapi.json` → generate client cho **cả** `apps/fe` và `apps/qr-admin`.
  Không hand-edit artifact generated.
- **NFR-QR-02** `apps/qr-admin` là workspace app sibling, có package scripts/gates riêng; không
  import mã nguồn từ `apps/fe` và ngược lại. Chỉ chia sẻ qua `packages/*` khi thật sự cần.
- **NFR-QR-03** UI vi-first, desktop-first, accessible bằng keyboard; không cần PWA/offline cho
  phase ship-first.
- **NFR-QR-04** Không log URL có credentials (vốn bị cấm), access token, hay SVG payload đầy đủ.
- **NFR-QR-05** Endpoint ảnh không public ở MVP: cùng bearer policy với metadata để URL đích không
  vô tình trở thành một catalogue công khai.

## 6. API contract dự kiến

| Endpoint | Permission | Mục đích |
| --- | --- | --- |
| `POST /qr-links` | `qr:create` (owner) | Tạo `QrLink` từ `targetUrl`, `label?` |
| `GET /qr-links?page=&limit=` | `qr:list` (owner) | Danh sách metadata mới nhất |
| `GET /qr-links/:id` | `qr:read` (owner) | Metadata một QR |
| `GET /qr-links/:id/image.svg` | `qr:read` (owner) | Render/download SVG (`image/svg+xml`) |

Response metadata không trả SVG inline để list/page payload nhỏ và cache semantics rõ. Admin dựng preview
bằng endpoint SVG có bearer-aware request/blob URL; download dùng cùng blob, không đặt bearer token lên
`<img src>`.

## 7. Ngoài phạm vi MVP

- Short URL / redirect domain, public landing page, scan analytics, expiry/revocation, UTM builder.
- QR có logo, màu tuỳ chỉnh, PNG/PDF/batch export, upload file, import CSV.
- Liên kết QR với dress/rental hoặc hiển thị trong `apps/fe`; có thể thêm contract query sau nếu
  một nhu cầu cụ thể xuất hiện.

## 8. Traceability và thứ tự ship

| FR | Feature id dự kiến | Design | Thứ tự |
| --- | --- | --- | --- |
| FR-QR-01..04 | `qr/create-url-code` | [qr-aggregate.md](./design/qr-aggregate.md) | BE → contract → QR admin |
| FR-QR-05, NFR-QR-02..03 | `infra/qr-admin-bootstrap` | [qr-admin.md](./design/qr-admin.md) | Bootstrap app trước UI feature |

`infra/qr-admin-bootstrap` và `qr/create-url-code` được theo dõi trong `feature_list.json`.
Chỉ một entry được promote `in-progress` tại một thời điểm.

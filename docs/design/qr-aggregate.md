# qr — Tactical Design

> Status: **as-built 2026-08-06** · SRS: FR-QR-01..04, FR-QR-06, BR-QR-01..05 · Context Supporting

## Vai trò & ranh giới

`qr` sở hữu lịch sử QR URL và việc render mã QR SVG. Context nhận URL đã được admin nhập, kiểm tra
an toàn cú pháp, lưu bản ghi và render QR; nó không resolve URL, không redirect, không track scan và
không biết về dress/rental.

## Aggregate

| Aggregate root | Internal entities | Value objects | Enums/types |
| --- | --- | --- | --- |
| `QrLinkEntity` | — | `TargetUrl` | `QrLinkId` |

`QrLinkEntity` bất biến sau create. Lý do: QR in ra ngoài không được thay URL âm thầm; replacement là
một QR mới, giữ audit history đơn giản.

## State machine

Không có lifecycle MVP: `create → persisted`; không có update, revoke hay delete endpoint.

## Bảng invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| URL là absolute `http(s)`, không credentials, ≤2.048 chars | `TargetUrl.create` sau `new URL()` | `target_url NOT NULL`; syntax/allow-list không diễn đạt an toàn bằng DB portable | 400 `QR.INVALID_TARGET_URL` | Unit test scheme/relative/credentials/length |
| Record luôn có người tạo hợp lệ | Command lấy `subject.staffId`, không nhận từ body | `created_by_staff_id NOT NULL REFERENCES staff_users(id)` | 401/500 nếu bypass DB | migration/integration FK test |
| Chỉ owner tạo/đọc/render | `@RequirePermission('qr:*')` | N/A — authorization là boundary, không row invariant | 401/403 | controller/policy tests |
| SVG phản ánh target URL đã persist | renderer chỉ nhận `QrLinkEntity.targetUrl` | N/A — deterministic pure adapter output | 200 SVG, không phải URL request body | controller/renderer unit test |
| Nhận diện QR không làm giảm vùng quét | renderer sinh QR với quiet zone và chỉ vẽ khung/trái tim/text ở ngoài SVG QR lồng bên trong | N/A — presentation không là persisted invariant | SVG đỏ hồng có khung/trang trí; QR modules không bị sửa | Renderer unit test kiểm outer SVG + nested QR SVG |

Không có critical concurrency invariant; UUID PK loại bỏ collision thực tế. Nếu sau này thêm
short-code/public redirect, uniqueness của short-code và expiry/revocation state machine sẽ là design-tier
mới, không chen vào phase này.

## Persistence sketch

`qr_links`: `id uuid PK`, `target_url text NOT NULL`, `label varchar(120) NULL`,
`created_by_staff_id uuid NOT NULL FK staff_users(id)`, `created_at timestamptz NOT NULL DEFAULT now()`.
Index `(created_at DESC, id DESC)` cho list newest-first. Không lưu binary/SVG: SVG được render từ
`target_url` khi đọc, tránh storage, cache invalidation và source-of-truth thứ hai.

## Cross-context contracts

| Contract query/event | Owner | Consumer | Returns |
| --- | --- | --- | --- |
| JWT subject | identity/shared guard | qr | `staffId`, role |

Không query bảng `identity` trực tiếp; FK do migration chịu trách nhiệm tham chiếu. `qr` không có
consumer event, nên không dựng outbox/relay.

## Ports và API

`QrLinkRepositoryPort` owns persistence; `QrRendererPort` wraps QR SVG library in an adapter. Adapter
dùng error correction `H`, module đỏ hồng trên nền trắng và bọc output thư viện bằng một khung/trái tim
tĩnh ở ngoài quiet zone; không có style được lưu hay chọn theo từng record. Slices:
`create-url-code`, `list-qr-links`, `get-qr-link`, `render-qr-link-svg`. HTTP tag `qr-links`; image
controller sets `Content-Type: image/svg+xml`; client download blob thay vì token trên URL.

## Open questions / ADR links

- Chưa có redirect/analytics là deliberate scope boundary, không phải thiếu implementation.
- Nếu URL `http://` gây rủi ro thương hiệu, đổi allow-list thành HTTPS-only trước scaffold; SRS hiện
  cho phép HTTP để QR dùng với local/intranet ở phase đầu.

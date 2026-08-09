# identity — Tactical Design

> Status: **as-built 2026-08-09** (re-synced with ADR 0001: credential rejections are 422 outcomes, 401 = guard only) · SRS: FR-AUTH-01..03 · Context Generic

## Vai trò & ranh giới

AuthN (JWT access + refresh, bcrypt) và AuthZ (ABAC fail-closed) cho toàn hệ thống. Đây là
context **mỏng có chủ ý**: không có aggregate giàu — `staff_users` là bảng + `TokenService`;
nghiệp vụ thật nằm ở các context kia.

## Thành phần

| Thành phần | Chi tiết |
| --- | --- |
| `staff_users` | id, email UNIQUE, password bcrypt, role `owner \| staff` (DB CHECK) |
| `TokenService` | 2 secret riêng cho access/refresh; login/refresh/me (`@Public()` cho login/refresh) |
| `JwtAuthGuard` (global #1) | Bearer → `request.user = { staffId, role }` |
| `PoliciesGuard` (global #2) | `@RequirePermission('<resource>:<action>')` → `libs/authz/policy-registry` — **fail-closed**: permission chưa đăng ký = DENY |

Mỗi context tự đăng ký policy trong `<ctx>.policies.ts`. Hiện chỉ `dress:retire` là owner-only;
các policy rentals đều cho mọi staff — hạ tầng ABAC đầy đủ cho 2 role là thừa nhận
over-engineering nhẹ, giữ vì đã ship và fail-closed là đúng hướng (không mở rộng thêm cho tới
khi có role thứ 3 — spec 01 §8).

## Bảng invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| Email duy nhất | pre-check khi seed/tạo user | `UNIQUE (email)` | seed script exit 1 (không có endpoint tạo user) | `test:e2e` → `identity-unique-email.e2e-spec.ts`: INSERT trùng email bị `UNIQUE` chặn |
| Role hợp lệ | TypeScript union | `CHECK (role IN ('owner','staff'))` | — | e2e: INSERT role rác bị `CHECK` chặn |
| Permission chưa đăng ký bị từ chối | `policy-registry` fail-closed | (không áp dụng) | 403 **envelope** `GENERIC.FORBIDDEN` — guard chặn TRƯỚC use case, nên không phải outcome ([ADR 0001](../adr/0001-outcome-model-at-the-http-boundary.md) §3) | unit test registry (có) |
| Sai mật khẩu / refresh token không hợp lệ | `LoginService` / `RefreshTokenService` trả `Err(InvalidCredentialsError)` | (không áp dụng) | outcome `rejected_invalid_credentials` / `rejected_invalid_refresh_token` (422) — **401 chỉ dành cho guard** | unit service (có) + e2e |

## Cross-context

Không đọc/ghi context nào. Cung cấp `request.user` cho mọi controller qua global guards.

## Open questions

- Không có quản lý user runtime (tạo/khóa staff) — seed script duy nhất. Cần thì là FR mới.
- Refresh token trong localStorage FE (file duy nhất được phép — arch check f3): trade-off đã
  ghi ở `apps/fe/AGENTS.md`.

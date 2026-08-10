# identity — Tactical Design

> Status: **as-built 2026-08-10** (identity/manage-users: username login, account lock, owner
> quản lý user) · SRS: FR-AUTH-01..04 · Context Generic

## Vai trò & ranh giới

AuthN (JWT access + refresh, bcrypt) và AuthZ (ABAC fail-closed) cho toàn hệ thống, cộng vòng
đời tài khoản nhân viên. Context vẫn **mỏng có chủ ý**: `StaffUserEntity` là aggregate nhỏ
(khoá/mở/đổi mật khẩu), nghiệp vụ thật của tiệm nằm ở các context kia.

## Thành phần

| Thành phần | Chi tiết |
| --- | --- |
| `staff_users` | id, **username** (UNIQUE trên `lower(username)`), name (tên hiển thị), role `owner \| staff` (DB CHECK), password_hash, **active** boolean |
| `StaffUserEntity` | `create()` (luôn role staff), `deactivate()` / `reactivate()` (Result), `resetPassword()` — khoá chứ không xoá (FK lịch sử trỏ tới user vĩnh viễn) |
| `Username` VO | lowercase-hoá + `^[a-z0-9][a-z0-9._-]{2,29}$` — một luật, hai lưới (VO + UNIQUE index) |
| `TokenService` | 2 secret riêng cho access/refresh; login/refresh (`@Public()`), me |
| `JwtAuthGuard` (global #1) | Bearer → `request.user = { staffId, role }` |
| `PoliciesGuard` (global #2) | `@RequirePermission('<resource>:<action>')` → `libs/authz/policy-registry` — **fail-closed**: permission chưa đăng ký = DENY |

Use cases: `login`, `refresh-token`, `me`, `create-user`, `deactivate-user`, `reactivate-user`,
`reset-password`, `list-users`. Bốn use case quản lý dùng chung MỘT permission `user:manage`
(owner-only) — tách ra khi có role thứ ba, không sớm hơn (spec 01 §8).

## Bảng invariant-enforcement

| Invariant | Application check | Cơ chế DB | Vi phạm → | Proof test |
| --- | --- | --- | --- | --- |
| Username duy nhất (case-insensitive) | `Username` VO + pre-check `findOneByUsername` | `UNIQUE INDEX lower(username)` | outcome `rejected_username_taken` (422) + `username` — cả pre-check lẫn race (repo dịch `UsernameConflictError`, pattern DressCode) | `test:e2e` → `identity-users.e2e-spec.ts`: khác hoa thường, race 2 create, INSERT thẳng |
| Role hợp lệ | endpoint chỉ tạo `staff` (R4) | `CHECK (role IN ('owner','staff'))` | — | e2e: INSERT role rác bị `CHECK` chặn |
| Account khoá không vào được | login trả `AccountLockedError` SAU khi so mật khẩu; refresh đọc `active` cùng query nạp user | (không áp dụng — luật thời điểm) | login đúng mật khẩu → `rejected_account_locked`; refresh → `rejected_invalid_refresh_token`; access token sống hết TTL (trade-off nêu rõ) | e2e: khoá → login/refresh chết → mở → sống lại |
| Không tự khoá mình | so `userId === actorId` TRƯỚC khi load | (không áp dụng) | `rejected_cannot_deactivate_self` (422) | unit + e2e |
| Permission chưa đăng ký bị từ chối | `policy-registry` fail-closed | (không áp dụng) | 403 **envelope** `GENERIC.FORBIDDEN` — guard chặn TRƯỚC use case ([ADR 0001](../adr/0001-outcome-model-at-the-http-boundary.md) §3) | e2e: staff gọi POST /users |
| Hash không bao giờ lên dây | DTO liệt kê field, không spread | (không áp dụng) | — | e2e so key-level của GET /users |

## Cross-context

Không đọc/ghi context nào. Cung cấp `request.user` cho mọi controller qua global guards.
`price-history` (catalog) sẽ đọc bảng `staff_users` qua adapter riêng của NÓ để lấy tên người
đổi giá — deviation #4, ghi ở [catalog/price-history.md](./catalog/price-history.md).

## Domain events

`UserCreated / UserDeactivated / UserReactivated` — 0 consumer (chờ nhu cầu thật).

## Open questions

- ~~Không có quản lý user runtime~~ — **đã làm 2026-08-10**: FR-AUTH-04 →
  [identity/manage-users.md](./identity/manage-users.md) (spec `as-built`).
- Staff tự đổi mật khẩu mình: FR sau, chủ tiệm đã chốt MVP đi qua owner (spec §6.Q5).
- Refresh token trong localStorage FE (file duy nhất được phép — arch check f3): trade-off đã
  ghi ở `apps/fe/AGENTS.md`.

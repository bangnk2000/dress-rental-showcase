# Quản lý tài khoản nhân viên — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `identity` (Generic) |
| Status | **approved 2026-08-10** — chủ tiệm đồng ý toàn bộ gợi ý §6 |
| AC source | Đề bài chủ tiệm 2026-08-10: *"owner tạo account và cho đăng nhập bằng username/password"*. FR đề xuất: **FR-AUTH-04** + sửa **FR-AUTH-01** (định danh đăng nhập) |
| Rules approved by | Chủ tiệm — 2026-08-10 ("tôi đồng ý", chốt theo gợi ý agent ở §6) |
| Contract approved by | Chủ tiệm (đại diện cả hai phía, cùng repo cùng commit) — 2026-08-10 |

> Vì sao là design-tier: identity từ "bảng + seed script" thành context có use case thật —
> và đây là feature làm cho MỌI luật owner-only đang có (retire, waiver phí trễ, sắp tới
> [giá nhập](../catalog/purchase-price.md)) **có nghĩa ngoài đời**: hôm nay cả tiệm đăng nhập
> chung account owner nên phân quyền chỉ đúng trên giấy. Đổi định danh đăng nhập cũng là thay
> đổi contract breaking đầu tiên của `POST /auth/login` (§6.Q1).

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Tài khoản (`staff_user`) | Một người đăng nhập được: username, password, role, trạng thái | bảng đã có; thêm `username`, `active` |
| Username | Định danh đăng nhập ngắn, duy nhất, tiệm tự đặt ("lan", "chi-ca") | mới; thay/đứng cạnh email — §6.Q1 |
| Khoá tài khoản (`deactivate`) | Chặn đăng nhập + refresh; KHÔNG xoá — lịch sử (changed_by, sổ tiền) còn trỏ tới | mới; không có delete |
| Role | `owner` \| `staff` — như DB CHECK hiện tại | owner do seed; endpoint chỉ tạo staff (§6.Q3) |

## 2. Use-case specification

```text
Use case: owner tạo/khoá/mở/đặt-lại-mật-khẩu tài khoản; đăng nhập bằng username/password
Actor: quản lý user — CHỈ owner (policy user:manage, owner-only, fail-closed như dress:retire);
       login/refresh — public như hiện tại
Trigger:
  POST /auth/login              — body đổi theo §6.Q1 (username thay email)
  POST /users                   { username, password, displayName? (§6.Q2) } → tạo staff
  GET  /users                   → list (không bao giờ trả hash)
  POST /users/:id/deactivate    — khoá
  POST /users/:id/reactivate    — mở lại
  POST /users/:id/reset-password { newPassword } — owner đặt thẳng (tiệm không có email
                                   để gửi link; nói mồm ở quầy là kênh thật)

Business input:
  - username: 3..30 ký tự [a-z0-9._-], lowercase-hoá trước khi so — gõ trên bàn phím
    điện thoại không vật lộn hoa thường
  - password: ≥ 8 ký tự (bcrypt như hiện tại); không bắt ký tự đặc biệt — độ dài thắng
    độ rối cho một công cụ nội bộ

Business flow (các bước từ chối):
  create user:
    1. username đã tồn tại                          → rejected_username_taken
  deactivate:
    1. tự khoá chính mình                           → rejected_cannot_deactivate_self
       (owner cuối cùng tự khoá = không ai mở lại được — chặn từ luật, không chờ hỗ trợ kỹ thuật)
    2. đã khoá rồi                                  → rejected_user_already_inactive
  reactivate: đã active                             → rejected_user_already_active
  reset-password: user không tồn tại → 404 envelope; user bị khoá vẫn đặt lại được
    (đặt mật khẩu là chuẩn bị cho mở khoá, không phải hành động của user đó)
  login:
    1. username không có / password sai             → rejected_invalid_credentials (như cũ —
                                                      login KHÔNG lộ user có tồn tại hay không)
    2. user bị khoá, credentials ĐÚNG               → rejected_account_locked (§6.Q4)
  refresh:
    1. user bị khoá                                 → rejected_invalid_refresh_token (gộp —
       token chết là token chết, lý do không cần phân biệt trên kênh này)

Domain rules / invariants:
  - R1 (AC1): username duy nhất — UNIQUE INDEX lower(username); pre-check trả outcome,
              race dịch ở adapter (pattern quen).
  - R2 (AC2): tài khoản bị khoá không đăng nhập/refresh được; access token đang sống vẫn
              chạy tới hết TTL — chấp nhận, nêu rõ (stateless JWT; TTL ngắn).
  - R3 (AC3): không xoá user — chỉ khoá. Mọi FK (changed_by của price-history, creator của
              qr_links) an toàn vĩnh viễn.
  - R4 (AC4): endpoint chỉ tạo role `staff` (§6.Q3). Owner duy nhất đến từ seed.
  - R5: response không bao giờ chứa password hash (kể cả list) — DTO liệt kê field, không
        spread entity.

Side effects / domain events: UserCreated/Deactivated/Reactivated — 0 consumer (pattern repo).
Idempotency: not required — create bị R1 chặn replay; deactivate/reactivate lần hai trả
  outcome already-* nói đúng sự thật (pattern record-collection).
Concurrency: hai create trùng username → UNIQUE quyết; khoá-vs-refresh: refresh đọc active
  trong cùng query nạp user — thua thì nhận invalid_refresh_token, không có cửa sổ kéo dài.
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload |
| --- | --- | --- | --- |
| `rejected_username_taken` | username đã có | 422 | `username` (bản lowercase đã đụng) |
| `rejected_cannot_deactivate_self` | owner tự khoá mình | 422 | — |
| `rejected_user_already_inactive` | khoá lần hai | 422 | — |
| `rejected_user_already_active` | mở lần hai | 422 | — |
| `rejected_account_locked` | đăng nhập đúng credentials vào account bị khoá | 422 | — (§6.Q4) |
| `rejected_invalid_credentials` | như hiện tại | 422 | — |

Quyền quản lý user chặn ở guard (`user:manage` chưa đăng ký cho staff → 403 **envelope**
`GENERIC.FORBIDDEN`) — nhất quán ADR 0001: guard chặn trước use case thì không phải outcome.

## 3. UI state matrix

Route mới `/users` (owner-only — menu item ẩn với staff; route tự redirect nếu `me.role`
khác owner; luật thật vẫn ở BE):

| State | Condition | Display / action |
| --- | --- | --- |
| list | ≥ 1 user (luôn — có owner) | bảng: username · role · trạng thái (Đang hoạt động/Đã khoá) · hàng của CHÍNH MÌNH không có nút khoá |
| create dialog | mở từ nút "Thêm nhân viên" | username + password (+ displayName nếu Q2); validation inline; username-taken → field error |
| khoá/mở | confirm qua `ConfirmDialog` (không window.confirm) | optimistic không cần — invalidate list; nút per-row spinner theo `variables` (bài học board) |
| reset password | dialog riêng, ô mật khẩu mới + đọc lại | thành công → toast "Đã đặt lại mật khẩu cho {username}" |
| already-* | outcome tương ứng | toast nêu trạng thái thật + refetch (ai đó vừa thao tác trên thiết bị khác) |
| login form | — | ô Email đổi thành Username (label + autocomplete="username"); message sai vẫn chung chung |
| account-locked | `rejected_account_locked` khi login | message riêng "Tài khoản đã bị khoá — hỏi chủ tiệm" |
| network/validation | — | pattern chuẩn |

Accessibility: bảng có caption; dialog focus-trap sẵn từ primitive; password field có nút
hiện/ẩn đúng chuẩn `aria-pressed`. Responsive: bảng cuộn ngang container riêng.

## 4. FE data needs

- `GET /users` → `{ data: [{ id, username, role, active, createdAt }] }` — màn hình một bảng,
  không phân trang (tiệm < 10 người; ghi rõ để khỏi xây pagination vô ích).
- `GET /auth/me` thêm `username` (+ displayName nếu Q2) — FE đang chỉ có role/email.
- Login mutation đổi body theo Q1 — **một chỗ** trong auth feature, mutator không đổi.
- Strongly consistent.

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | tạo user mới → đăng nhập được bằng username/password đó; username trùng (khác hoa thường) → `rejected_username_taken`; race 2 create → UNIQUE + outcome | application unit + `test:e2e` |
| AC2 | khoá → login đúng password trả `rejected_account_locked`, refresh token cũ trả `rejected_invalid_refresh_token`; mở lại → login được | `test:e2e` |
| AC3 | không tồn tại DELETE /users/* trong contract | contract check khi emit |
| AC4 | staff token gọi POST /users → 403 envelope (fail-closed) | `test:e2e` |
| AC5 | reset-password → password cũ chết, mới sống | `test:e2e` |
| — | tự khoá mình → `rejected_cannot_deactivate_self` | application unit |
| — | list không chứa hash (so key) | e2e |
| — | /users route: staff bị redirect; bảng + create + khoá/mở + reset | vitest (FE) |
| — | **smoke.sh + Playwright + seed đổi credentials đăng nhập theo Q1** — sửa cùng commit | e2e |

## 6. Decisions (chủ tiệm chốt 2026-08-10 — "tôi đồng ý", toàn bộ theo gợi ý agent)

| # | Question | Quyết định |
| --- | --- | --- |
| 1 | Định danh đăng nhập | **Chuyển hẳn sang username** — email bỏ khỏi định danh; account owner seed thành username `owner`. Một cột định danh là một sự thật; staff không có email công việc |
| 2 | Tên hiển thị | **Có, optional** (`displayName` nullable) — vết trong sổ hiện "Chị Lan" thay vì "lan-2" |
| 3 | Owner thứ hai | **Chưa** — endpoint chỉ tạo `staff` (R4); mở rộng khi có nhu cầu thật |
| 4 | Login vào account bị khoá | **Nêu rõ** — outcome `rejected_account_locked` riêng; công cụ nội bộ, không có kẻ dò tài khoản |
| 5 | Staff tự đổi mật khẩu | **MVP: qua owner** (reset-password); tự đổi là FR sau, không tốn kiến trúc |

Quyết định phái sinh (agent chốt, bác được):

| # | Vấn đề | Chốt | Vì sao |
| --- | --- | --- | --- |
| 6 | Khoá vs xoá | chỉ khoá (R3) | FK lịch sử trỏ tới user vĩnh viễn; xoá là mất vết |
| 7 | Access token của user vừa bị khoá | sống hết TTL (R2) | stateless JWT; danh sách đen là hạ tầng mới không đáng cho TTL ngắn — NÊU RÕ trade-off |
| 8 | Policy name | `user:manage` MỘT permission cho cả 4 hành động | 4 permission riêng cho một màn owner-only là ABAC trang trí; tách khi có role thứ 3 (đúng ghi chú identity-aggregate) |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~blocker~~ **đã giải quyết** | Q1 chốt: chuyển hẳn username — `POST /auth/login` breaking change, đụng seed, smoke.sh, Playwright, cả hai FE login form | §6.Q1 | migration đặt username cho account seed ngay trong PR; mọi kịch bản test đổi cùng commit |
| ~~blocker~~ **đã giải quyết** | Q4 chốt: `rejected_account_locked` là outcome riêng của login | §6.Q4 | vào ADR 0001 §3 cùng PR |
| major | 5 outcome mới + login thay đổi phải vào ADR 0001 §3 trước code | §2 | cập nhật ADR cùng PR |
| major | `active` phải được đọc trong CÙNG query nạp user ở cả login lẫn refresh — hai chỗ, dễ sửa một quên một | §2 concurrency | một hàm nạp user chung cho cả hai service |
| major | qr-admin cũng đăng nhập (owner) — login form + errors seam của NÓ đổi theo Q1 trong cùng đợt | apps/qr-admin | đổi cả hai client một PR |
| minor | `username` lowercase-hoá: chuẩn hoá ở DTO transform, so ở DB bằng lower() — một luật hai lưới | §2 R1 | như DressCode VO |
| minor | GET /users không phân trang — ghi chú "by design, < 10 rows" trong @ApiOperation | §4 | ghi chú |

Mục 2 (leakage — R5 chặn), 5 (read efficiency): không có finding.

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

## 7. Re-sync as-built (2026-08-10)

Implement khớp spec với BA lệch nhỏ, đều ghi rõ:

1. **`rejected_user_not_found` (422) thay cho 404 envelope** ở reset-password/deactivate/
   reactivate — theo convention command-trên-aggregate-không-tồn-tại của repo (retire-dress,
   record-collection đều 422), không phải 404.
2. **displayName = cột `name` có sẵn** — bảng đã có tên hiển thị từ bootstrap, không thêm cột.
3. **Self-lock chặn cho MỌI actor** (so `userId === actorId` trước cả khi load row) — luật bảo
   vệ người quản lý cuối cùng, không phân biệt role.

| Spec | Code |
| --- | --- |
| Migration | `1755000000000_staff_users_username_active.js` — username backfill từ local-part email, UNIQUE `lower(username)`, `active` default true, DROP email; down tái tạo email `<username>@example.com` (mất dữ liệu thật — nêu rõ) |
| Entity + R3 | `domain/staff-user.entity.ts` (deactivate/reactivate Result, resetPassword) + 3 events |
| `Username` VO | `domain/username.value-object.ts` |
| R1 (răng ở DB) | pre-check + `UsernameConflictError` dịch ở `staff-user.repository.ts` |
| Login/refresh | `login.service.ts` (locked check SAU khi so mật khẩu), `refresh-token.service.ts` (`!staff.active` → generic) |
| 4 command + list | `commands/{create-user,deactivate-user,reactivate-user,reset-password}/`, `queries/list-users/` |
| Policy | `identity.policies.ts` — `user:manage` owner-only |
| Outcome catalog | ADR 0001 §3 bảng identity mở rộng + §4 state matrix |
| FE | `features/users/` (route /users tự guard theo me.role, bảng + 3 dialog, hàng của mình không có nút khoá), login form username, nav owner-only |
| qr-admin | login form username + copy `rejected_account_locked` trong errors seam |
| Test đổi theo | seed (`SEED_OWNER_USERNAME`), smoke.sh, Playwright happy path, e2e harness (`OWNER_USERNAME`), MSW fixtures |
| Traceability §5 | be 126 unit (+12) · 55 e2e (13 ca `identity-users.e2e-spec.ts`) · fe 87 vitest (+4) · qr-admin 17 |

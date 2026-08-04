# qr-admin — Bootstrap & Slice Design

> Status: **approved 2026-08-04** · SRS: FR-QR-01..05, NFR-QR-01..03 · API tags: `qr-links`

## 0. Bootstrap brief và UX flow

`apps/qr-admin/` là Vite + React + TypeScript admin tối giản, workspace sibling của `apps/fe/`.
Nó dùng cùng API/identity nhưng sở hữu router, generated client, components, locales và test scripts
riêng; không import mã nguồn từ `apps/fe`. PWA, Google auth, sidebar và design system lớn đều ngoài
scope. vi là ngôn ngữ duy nhất của app này ở MVP.

Owner flow:

1. Mở `/`, chưa có token thì thấy form đăng nhập email/password.
2. Đăng nhập thành công → form “Tạo QR URL” và lịch sử QR; `staff` nhận 403 thông báo không có quyền.
3. Nhập URL + nhãn tuỳ chọn, submit → validation inline; 400 giữ nguyên form, 401 refresh/đăng nhập
   lại, 403 hiển thị quyền bị từ chối.
4. Thành công → preview SVG, nút “Tải SVG”, toast thành công và danh sách refresh với QR mới đầu.
5. Chọn hàng lịch sử → preview/load SVG của record đó và tải lại được.

```text
+------------------------------------------------------------+
| QR URL Admin                         [Đăng xuất]           |
| URL đích [https://....................................]    |
| Nhãn    [poster cửa hàng..............................]    |
|                                      [Tạo mã QR]           |
|                                                            |
| [preview QR SVG]       [Tải SVG]                           |
|------------------------------------------------------------|
| Lịch sử: nhãn | URL (truncate) | tạo lúc | [Xem QR]        |
+------------------------------------------------------------+
```

## 1. Routes & URL state

| Route | Guard | URL state |
| --- | --- | --- |
| `/login` | public | none |
| `/` | authenticated owner | `page` only when history exceeds one page |

Selected QR, form fields, preview blob URL, modal/toast state là component state. Server list/detail
lives only in TanStack Query; token follows the existing bearer + refresh protocol but is implemented
locally in `apps/qr-admin/src/api/mutator/`, never imported from `apps/fe`.

## 2. Data & contract map

The app gets a second generated client at `apps/qr-admin/src/api/generated/` from the same
`packages/contract/openapi.json`; root scripts expand contract generation/check to include it.

| Action | Generated operation | Cache behaviour |
| --- | --- | --- |
| Login/refresh | existing auth operations | token side effect only |
| Create QR | `POST /qr-links` | invalidate `['qr-links']`; set preview from new id |
| List history | `GET /qr-links?page&limit` | `['qr-links', {page, limit}]` |
| View/download SVG | `GET /qr-links/:id/image.svg` through hand-written blob adapter | `['qr-link-svg', id]`, revoke blob URL on replacement/unmount |

The image endpoint cannot be used directly in an `<img>` because bearer auth cannot be attached; fetch
it as Blob, create an object URL, and use that for preview/download. Never put access tokens in query
strings or localStorage.

## 3. Interaction state machine

| State | Create | View/download |
| --- | --- | --- |
| anonymous | disabled; redirect/login | unavailable |
| owner, idle | enabled after form valid | latest/selected QR available |
| submitting | disabled, progress text | existing preview remains usable |
| create error | enabled; preserve inputs + inline/toast error | unchanged |
| created | enabled for next QR; preview selected | enabled |
| staff / 403 | disabled, access-denied screen | unavailable |

## 4. Screen states & error policy

- History: skeleton while loading; “Chưa có mã QR nào” empty; retry button for 5xx/network failure.
- Form: exact Vietnamese copy for invalid URL, forbidden, server failure. 400 is local form error;
  401 invokes one refresh then `/login`; 403 is terminal access denied.
- SVG: loading placeholder; a failed blob fetch never discards the last good preview. Download link
  is enabled only when a blob exists.

## 5. Form ↔ DTO mapping

| Form field | DTO | Rule |
| --- | --- | --- |
| `targetUrl` | `targetUrl` | trim; Zod requires valid absolute http(s), no credentials, ≤2.048 |
| `label` | `label?` | trim; empty becomes omitted; ≤120 |

## 6. Test & delivery plan

- Unit/RTL: URL validation, anonymous redirect, successful create→preview→list invalidation, 400/403,
  empty/error history, and Blob URL cleanup.
- API/BE: create/list/get/render unit tests; policy 403; real-Postgres migration/FK proof once the
  repo's `test:e2e` gap is closed.
- Runtime: `pnpm --filter qr-admin dev` against running BE; owner creates a QR, SVG downloads and
  decodes to exactly target URL (script/library assertion), staff gets 403.
- Delivery order: bootstrap `apps/qr-admin` + root contract scripts, then `qr/create-url-code` as
  one BE → contract → QR-admin feature entry. Do not modify `apps/fe` for this phase.

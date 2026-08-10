# Giá nhập của váy — chỉ chủ tiệm nhập và nhìn thấy — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `catalog` (Supporting) |
| Status | **approved 2026-08-10** — chủ tiệm đồng ý toàn bộ gợi ý §6 |
| AC source | Đề bài chủ tiệm 2026-08-10: *"thêm thông tin giá nhập cho váy, chỉ chủ shop được nhập và nhìn thấy"*. FR đề xuất: **FR-CAT-05** |
| Rules approved by | Chủ tiệm — 2026-08-10 ("tôi đồng ý", chốt theo gợi ý agent ở §6) |
| Contract approved by | Chủ tiệm (đại diện cả hai phía, cùng repo cùng commit) — 2026-08-10 |

> Vì sao là design-tier: đây là quy tắc **field-level authorization ĐẦU TIÊN** của repo — từ
> trước tới nay ABAC chỉ chặn theo HÀNH ĐỘNG (`dress:retire` owner-only), chưa bao giờ một
> field trong request/response đổi hình theo vai. Cách chốt ở đây thành tiền lệ cho mọi field
> nhạy cảm sau này.
>
> **Lưu ý phụ thuộc nghiệp vụ:** chừng nào [identity/manage-users](../identity/manage-users.md)
> chưa ship thì cả tiệm đăng nhập chung account owner — "chỉ owner nhìn thấy" đúng về máy nhưng
> rỗng về người. Không phụ thuộc kỹ thuật, nhưng nên ship SAU (hoặc cùng đợt với) manage-users.

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Giá nhập (`purchasePrice`) | Tiền tiệm bỏ ra để CÓ chiếc váy (mua/may) | mới; nullable — váy cũ có thể không còn nhớ |
| Giá thuê (`rentalPrice`) | Giá cho thuê chuẩn — public trong tiệm | đã có; KHÔNG đổi |
| Cọc chuẩn (`depositAmount`) | — | đã có; KHÔNG đổi |

## 2. Use-case specification

```text
Use case: đặt/sửa + đọc purchasePrice — KHÔNG có endpoint mới, field mới đi qua
  create-dress / update-dress / các read hiện có
Actor: ghi — CHỈ owner; đọc — CHỈ owner. Staff: field không tồn tại với họ
Authorization: policy dress:create/dress:update giữ nguyên (staff vẫn tạo/sửa váy);
  luật owner-only nằm Ở MỨC FIELD trong service:
    - body CÓ purchasePrice + actor không phải owner → 403 forbidden
      { status:'forbidden', reason:'purchase_price_owner_only' }
    - body KHÔNG có purchasePrice → hành vi cũ, bất kể vai
Trigger: POST /dresses · PATCH /dresses/:id (field optional mới) · đọc qua
  GET /dresses, GET /dresses/:id

Business input (delta):
  - purchasePrice? (VND integer ≥ 0; PATCH: undefined = giữ, null = xoá — cùng semantics
    merge đã có của update-dress)

Domain rules / invariants:
  - R1 (AC1): chỉ owner ghi được purchasePrice; staff gửi field này bị 403 NÊU TÊN lý do —
              không lặng lẽ bỏ qua field (bỏ lặng = staff tưởng đã lưu).
  - R2 (AC2): response cho staff KHÔNG CHỨA field (omit, không phải null) — null nói
              "chưa nhập", vắng mặt nói "không phải việc của bạn"; hai câu phải khác nhau.
  - R3 (AC3): purchasePrice không tham gia bất kỳ tính toán nào (phí, cọc, gợi ý) — nó là
              thông tin quản trị, không phải input nghiệp vụ.
  - R4: VND integer ≥ 0 qua Money VO + CHECK (purchase_price >= 0) — cùng lưới với giá thuê.

Side effects / domain events: không có event mới (đi trong DressCreated/updated hiện có).
Idempotency: not required — PATCH đã idempotent theo nghĩa merge.
Concurrency: last-write như mọi field dress khác (MVP).
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload |
| --- | --- | --- | --- |
| `forbidden` (reason `purchase_price_owner_only`) | staff cố ghi giá nhập | 403 | `reason` — cùng shape với waiver 403 của FR-RENT-09 |

Các outcome khác của create/update-dress giữ nguyên. Đây là 403 **outcome** (use case đã chạy
và từ chối theo luật nghiệp vụ), không phải 403 envelope của guard — phân biệt đúng ADR 0001 §3.

## 3. UI state matrix

| State | Condition | Display / action |
| --- | --- | --- |
| form (owner) | `me.role === 'owner'` | DressFormDialog có ô "Giá nhập" (optional, đọc lại số theo nhóm như mọi ô tiền) |
| form (staff) | role khác | ô KHÔNG render — không phải disabled (disabled mời hỏi "sao mờ?") |
| detail (owner) | có giá trị | dòng "Giá nhập: X" trong info grid; null → "Chưa nhập" |
| detail/list (staff) | — | không có gì để render — field vắng mặt trong response |
| list (owner) | §6.Q2 | cột Giá nhập trên bảng catalog (nếu Q2 = có) |
| forbidden | 403 `purchase_price_owner_only` | phòng hờ (UI đã ẩn ô): toast "Chỉ chủ tiệm được nhập giá nhập" |
| validation-error | 400 âm/không nguyên | field error như các ô tiền khác |

Accessibility/Responsive: không có pattern mới — form và grid hiện có.

## 4. FE data needs

- `DressResponseDto.purchasePrice?: number \| null` — **optional trong OpenAPI** (staff: omit;
  owner: number hoặc null). Client sinh ra đã chịu được vắng mặt.
- Response shaping theo vai xảy ra ở **một chỗ**: projection/controller của catalog đọc
  `request.user.role` — không rải if xuống SQL từng query (tiền lệ cho field nhạy cảm sau).
- FE đọc `me.role` (đã có qua `GET /auth/me`) để quyết render ô/cột — thuần hiển thị; luật thật
  nằm ở BE (R1/R2).

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | owner PATCH purchasePrice → lưu; staff PATCH cùng body → 403 named, DB không đổi | application unit + `test:e2e` |
| AC1 | staff PATCH KHÔNG kèm field → 200 như cũ (không hồi quy) | application unit |
| AC2 | GET detail/list bằng staff token → key `purchasePrice` VẮNG MẶT trong JSON; bằng owner token → có (số hoặc null) | `test:e2e` (so key, không so giá trị) |
| AC3 | không call-site nào ngoài catalog đọc cột mới | arch/grep khi implement |
| — | CHECK (purchase_price >= 0) chặn INSERT thẳng | `test:e2e` raw SQL |
| — | form owner có ô, form staff không render ô | vitest (FE, mock me) |

## 6. Decisions (chủ tiệm chốt 2026-08-10 — "tôi đồng ý", toàn bộ theo gợi ý agent)

| # | Question | Quyết định |
| --- | --- | --- |
| 1 | Đường nhập cho ~200 váy cũ | **Cột optional `purchase_price` trong CSV importer** (re-run idempotent; import là script owner-chạy nên không đụng field-level rule) |
| 2 | Hiện ở đâu | **Chỉ trang chi tiết** — không cột list; màn list dùng chung ở quầy |
| 3 | Lịch sử giá nhập | **Không** (MVP) — gần như bất biến sau khi mua |

Quyết định phái sinh (agent chốt, bác được):

| # | Vấn đề | Chốt | Vì sao |
| --- | --- | --- | --- |
| 4 | Staff gửi field → 403 hay lặng lẽ bỏ? | 403 nêu tên | bỏ lặng là nói dối UI; 403 named là pattern 403-outcome đã có |
| 5 | Ẩn với staff bằng omit hay null? | omit (R2) | null = "chưa nhập" phải nói được riêng cho owner |
| 6 | Endpoint riêng owner-only? | không — field trong create/PATCH | thêm endpoint là thêm một surface chỉ để né một câu if có kiểm chứng |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~blocker~~ **đã giải quyết** | Q1 chốt: CSV — importer + sample CSV + parser test đổi cùng commit | §6.Q1 | làm trong PR |
| major | Response shaping theo vai là cơ chế MỚI — phải có e2e so sánh key-level giữa hai token, không chỉ unit | §5 AC2 | viết e2e hai-token ngay từ đầu |
| major | OpenAPI một DTO cho hai vai (field optional) — người đọc contract không thấy luật vai | §4 | mô tả rõ trong `@ApiProperty({ description })`: "owner-only; omitted for staff" |
| minor | `forbidden` reason mới phải vào ADR 0001 §3 catalog TRƯỚC khi code | §2 outcome | thêm dòng vào ADR cùng PR |
| minor | vitest FE cần mock `me` theo hai vai — helper mock hiện có chỉ có owner | §5 | mở rộng helper |

Mục 1 (naming), 4 (state coverage), 5 (read efficiency), 8 (idempotency): không có finding.

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

## 7. Re-sync as-built (2026-08-10)

Implement khớp spec. Tiền lệ field-level đã đặt:

- **Ghi**: luật so `actorRole` khi field CÓ MẶT (kể cả null) chạy TRƯỚC mọi bước khác trong
  service; từ chối nêu tên qua 403 outcome. Staff không gửi field → hành vi cũ nguyên vẹn
  (unit test riêng cho ca "staff sửa tên, giá nhập giữ nguyên").
- **Đọc**: shaping ở MỘT chỗ — query nhận `readerRole` từ controller (`@CurrentSubject`), hai
  query handler spread-conditional. Lưu ý arch: `CurrentSubject` import từ
  `libs/authz/current-subject.decorator` (bản trong identity/guards là NỘI BỘ identity —
  depcruise bắt đúng lỗi này khi implement).

| Spec | Code |
| --- | --- |
| Migration | `1755200000000_dress_purchase_price.js` — nullable + CHECK ≥ 0; down DROP COLUMN |
| R1 (403 nêu tên) | `PurchasePriceOwnerOnlyError` → `{ status:'forbidden', reason:'purchase_price_owner_only' }` (403) ở cả create lẫn update; `PurchasePriceForbiddenOutcomeDto` |
| R2 (omit cho staff) | `readerRole` trên GetDressQuery/ListDressesQuery; e2e so KEY-level hai token |
| R3 | không call-site nào ngoài catalog đọc cột — chỉ hai projection |
| §6.Q1 CSV | cột `purchase_price` (parser + sample + test); importer chạy `actorRole:'owner'` |
| §6.Q2 (chỉ chi tiết) | detail line render theo SỰ TỒN TẠI của key server trả (không check role ở FE); bảng list không có cột |
| UI §3 | ô "Giá nhập" chỉ render cho owner trong DressFormDialog; staff edit gửi full form KHÔNG kèm field (vitest so key body PATCH) |
| Traceability §5 | be 146 unit (+5) · 72 e2e (+4 `purchase-price.e2e-spec.ts`) · fe 94 vitest (+2) |

# Danh mục váy — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `catalog` (Supporting) |
| Status | **approved 2026-08-10** — chủ tiệm đồng ý toàn bộ gợi ý §6 |
| AC source | Đề bài chủ tiệm 2026-08-10: *"thêm danh mục cho váy, mỗi váy thuộc một danh mục hoặc không (MVP)"*. FR đề xuất: **FR-CAT-07** |
| Rules approved by | Chủ tiệm — 2026-08-10 ("tôi đồng ý", chốt theo gợi ý agent ở §6) |
| Contract approved by | Chủ tiệm (đại diện cả hai phía, cùng repo cùng commit) — 2026-08-10 |

> Vì sao là design-tier: catalog mọc **aggregate root thứ hai** (`CategoryEntity`) và quan hệ
> FK đầu tiên giữa hai aggregate cùng context — xoá danh mục đang có váy là câu hỏi vòng đời
> phải chốt trước, không phải chi tiết implement.

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Danh mục (`category`) | Nhóm phân loại váy: "Dạ hội", "Cưới", "Áo dài"… | mới; do tiệm tự đặt, không có bộ cố định |
| Váy chưa phân loại | `categoryId = null` | hợp lệ vĩnh viễn (đề bài: "hoặc không") — không phải trạng thái lỗi |

## 2. Use-case specification

```text
Use case: CRUD danh mục (nhỏ) + gán danh mục cho váy + filter theo danh mục
Actor: quản lý danh mục — §6.Q1; gán vào váy — bất kỳ staff nào (đi theo dress:create/update)
Trigger:
  POST   /categories            { name }            — tạo
  PATCH  /categories/:id        { name }            — đổi tên
  DELETE /categories/:id                            — xoá (chỉ khi không còn váy)
  GET    /categories                                — list (mọi staff — form cần nó)
  POST/PATCH /dresses           + categoryId?: uuid | null   (field mới, optional)
  GET    /dresses               + ?categoryId=      (filter mới)

Business input (delta):
  - name (trim, 1..50 ký tự, duy nhất không phân biệt hoa thường)
  - categoryId? trên dress (null = bỏ phân loại)

Business flow (các bước từ chối):
  create category:
    1. name trùng (case-insensitive)               → rejected_category_name_taken (+ name chuẩn hoá)
  rename: như create; rename thành chính nó = no-op 200
  delete category:
    1. còn váy đang thuộc danh mục                 → rejected_category_in_use (+ dressCount)
    2. không còn váy                               → 200; KHÔNG cascade gì
  gán vào dress:
    1. categoryId không tồn tại                    → rejected_category_not_found

Domain rules / invariants:
  - R1 (AC1): tên danh mục duy nhất (không phân biệt hoa thường) — UNIQUE INDEX lower(name)
              làm lưới; pre-check trả outcome (pattern rejected_dress_code_taken).
  - R2 (AC2): một váy thuộc 0..1 danh mục — cột categoryId nullable, KHÔNG bảng nối
              (đề bài chốt single-category; nhiều-nhiều là FR khác nếu có).
  - R3 (AC3): không xoá danh mục còn váy — FK ON DELETE RESTRICT làm lưới, pre-check đếm
              và trả dressCount để owner biết phải dọn bao nhiêu.
  - R4: xoá/đổi tên danh mục KHÔNG đụng váy — quan hệ chỉ là nhãn, không vòng đời chung.

Side effects / domain events: CategoryCreated/Renamed/Deleted — 0 consumer (pattern repo).
Idempotency: not required — create trùng tên bị R1 chặn (replay an toàn); delete lần hai → 404.
Concurrency: hai create cùng tên → UNIQUE cho một bên thắng, bên thua nhận cùng outcome như
  pre-check (dịch lỗi ở adapter — pattern CollectionConflictError). Race delete-vs-gán:
  FK RESTRICT là trọng tài cuối, bên thua nhận outcome tương ứng.
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload |
| --- | --- | --- | --- |
| `rejected_category_name_taken` | tên đã tồn tại | 422 | `name` (bản chuẩn hoá đã đụng) |
| `rejected_category_in_use` | xoá danh mục còn váy | 422 | `dressCount` |
| `rejected_category_not_found` | gán categoryId không tồn tại | 422 | — |

(404 envelope cho GET/PATCH/DELETE id không tồn tại — như mọi resource khác.)

## 3. UI state matrix

Màn quản lý danh mục (§6.Q1 quyết nó nằm đâu — đề xuất: section trong trang catalog, không
route mới):

| State | Condition | Display / action |
| --- | --- | --- |
| list rỗng | chưa có danh mục | empty state + ô tạo nhanh (input + nút) — không cần dialog |
| có danh mục | ≥ 1 | chips/bảng: tên + số váy + sửa tên + xoá (xoá disabled kèm tooltip khi count > 0 — đỡ một round-trip biết trước kết quả; BE vẫn là người quyết) |
| name-taken | `rejected_category_name_taken` | field error dưới ô tên |
| in-use | `rejected_category_in_use` | toast "Còn {dressCount} váy trong danh mục này" |
| submitting/validation/network | — | pattern form chuẩn của repo |

Trên váy:

| State | Condition | Display / action |
| --- | --- | --- |
| DressFormDialog | — | Select "Danh mục" (option đầu: "Không phân loại" = null) từ GET /categories |
| catalog list | — | cột/badge tên danh mục ("—" khi null) + filter Select trong filters bar, `categoryId` vào URL như q/status |
| category-gone | `rejected_category_not_found` khi submit form váy | toast + refetch list danh mục (ai đó vừa xoá) |
| dress detail | — | dòng "Danh mục: X / Chưa phân loại" |

Accessibility: Select có label; filter đọc được từ URL (linkable — pattern use-rental-filters).
Responsive: chips wrap; cột danh mục ẩn ở màn hẹp nhất, filter vẫn còn.

## 4. FE data needs

- `GET /categories` → `{ data: [{ id, name, dressCount }] }` — `dressCount` BE đếm sẵn
  (màn quản lý + tooltip xoá cần nó; đếm ở FE là N+1).
- `DressResponseDto.category?: { id, name } | null` — denormalize tên để list/detail không tra
  thêm (screen-shaped, không chỉ trả id).
- Filter: `GET /dresses?categoryId=` — thêm điều kiện WHERE, giữ shape phân trang.
- Strongly consistent.

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | tạo "Dạ Hội" rồi "dạ hội" → `rejected_category_name_taken`; race 2 create cùng tên → [đúng 1 dòng, outcome kia giống pre-check] | application unit + `test:e2e` (UNIQUE lower(name) + raw INSERT) |
| AC2 | gán váy vào danh mục, đổi sang danh mục khác, bỏ về null — GET phản ánh | application unit + e2e |
| AC3 | xoá danh mục còn váy → `rejected_category_in_use` + dressCount; raw DELETE bị FK RESTRICT chặn | `test:e2e` |
| AC3 | xoá danh mục rỗng → 200; váy cũ không đổi | application unit |
| AC4 | filter ?categoryId= trả đúng tập con, phân trang giữ nguyên | e2e |
| — | form váy: Select gán/bỏ; list: filter qua URL | vitest (FE) |

## 6. Decisions (chủ tiệm chốt 2026-08-10 — "tôi đồng ý", toàn bộ theo gợi ý agent)

| # | Question | Quyết định |
| --- | --- | --- |
| 1 | Ai quản lý danh mục | **Mọi staff tạo/sửa tên; XOÁ là owner-only** (`category:delete`) — công cụ dọn dẹp hằng ngày không chờ chủ, nhưng xoá là hành động phá |
| 2 | CSV import | **Có cột `category`, tự tạo theo tên** — chuẩn hoá trim + case-insensitive như R1 |

Quyết định phái sinh (agent chốt, bác được):

| # | Vấn đề | Chốt | Vì sao |
| --- | --- | --- | --- |
| 3 | Bảng nối nhiều-nhiều? | không — cột nullable (R2) | đề bài chốt 0..1; YAGNI |
| 4 | Xoá danh mục còn váy: block hay set-null hàng loạt? | block + dressCount (R3) | set-null lặng lẽ xoá phân loại của N váy không ai duyệt; block thì owner thấy con số và tự quyết |
| 5 | Màn quản lý: route riêng hay section? | section trong trang catalog | 3-10 danh mục không đáng một route; đổi được khi implement nếu chật |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~blocker~~ **đã giải quyết** | Q1 chốt: `category:create/update` mọi staff, `category:delete` owner-only | §6.Q1 | đăng ký đúng như vậy trong catalog.policies.ts |
| major | 3 outcome mới phải vào ADR 0001 §3 trước khi code | §2 outcome | thêm bảng catalog cùng PR |
| major | `rejected_category_not_found` (422, gán) vs 404 envelope (GET id) — hai kênh cho "không tồn tại" đúng ADR nhưng dễ code nhầm | §2 flow | ghi chú trong controller khi implement |
| minor | `dressCount` trên GET /categories là aggregate query — giữ một query GROUP BY, không N+1 | §4 | viết projection có spec |
| minor | Filter categoryId vào URL — use-dress-filters hiện chỉ có q/status/page | §3 | mở rộng hook, test linkable |

Mục 2 (leakage), 8 (idempotency): không có finding.

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

## 7. Re-sync as-built (2026-08-10)

Implement khớp spec, một lệch nhỏ có lý do:

1. **`DressResponseDto.categoryId` thay vì object `{id,name}`** — FE nào cũng đã tải
   `GET /categories` (filter + form + màn quản lý), join tên client-side từ danh sách ~10 dòng
   cache sẵn KHÔNG phải N+1; denormalize tên vào từng dòng váy mới là trả giá vô ích. Ghi rõ
   trong `@ApiProperty`.
2. **Xoá danh mục không có domain event** — delete không đi qua aggregate instance; sự kiện chờ
   nhu cầu thật (spec 01 §8).

| Spec | Code |
| --- | --- |
| Migration | `1755100000000_categories.js` — UNIQUE lower(name), FK RESTRICT + index |
| R1 (răng ở DB) | `CategoryName` VO + pre-check + `CategoryNameConflictError` dịch ở `category.repository.ts` |
| R3/R4 (delete) | `delete-category.service.ts` pre-check count → `CategoryStillReferencedError` (FK) → cùng outcome, count tươi |
| Gán/bỏ (R2) | `categoryId` optional-nullable trên create/update dress; pre-check tồn tại → `rejected_category_not_found` |
| Filter (AC4) | `GET /dresses?categoryId=` + `use-dress-filters` (URL-owned) |
| CSV (§6.Q2) | cột `category` + auto-create trong `import-dresses.ts` (cache tên→id, case-insensitive) |
| Policy (§6.Q1) | `catalog.policies.ts`: create/update mọi staff, delete owner-only |
| UI §3 | `category-manager.tsx` (section trong trang catalog: tạo nhanh + sửa tên inline + xoá qua ConfirmDialog), Select trong DressFormDialog, cột + filter trên bảng, dòng ở detail |
| Traceability §5 | be 140 unit (+3 suite category) · 68 e2e (+6 `categories.e2e-spec.ts`) · fe 92 vitest (+3) |

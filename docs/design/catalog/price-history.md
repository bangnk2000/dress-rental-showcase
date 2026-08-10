# Lịch sử thay đổi giá thuê & tiền cọc — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | `catalog` (Supporting) |
| Status | **approved 2026-08-10** — chủ tiệm đồng ý toàn bộ gợi ý §6 |
| AC source | Đề bài chủ tiệm 2026-08-10: *"thêm version thay đổi của giá thuê và tiền cọc"*. FR đề xuất: **FR-CAT-06** |
| Rules approved by | Chủ tiệm — 2026-08-10 ("tôi đồng ý", chốt theo gợi ý agent ở §6) |
| Contract approved by | Chủ tiệm (đại diện cả hai phía, cùng repo cùng commit) — 2026-08-10 |

> Vì sao là design-tier: catalog mọc **bảng append-only đầu tiên** (`dress_price_history`) và một
> invariant xuyên bảng mới — "đổi giá mà không có dòng sử là trạng thái không tồn tại" — enforce
> bằng cùng-transaction chứ không có UNIQUE/EXCLUDE nào đỡ sau lưng, nên proof test phải nhắm
> đúng chỗ đó.
>
> Đơn thuê KHÔNG bị ảnh hưởng: `rental_items.price` đã snapshot giá thoả thuận từng đơn, tất toán
> đã đi theo cọc THỰC THU (FR-PAY-02). Bảng sử này là để chủ tiệm trả lời "giá váy này đổi khi
> nào, từ bao nhiêu, ai đổi" — không để sửa lại quá khứ.

## 1. Glossary slice

| Term | Meaning | Notes |
| --- | --- | --- |
| Dòng sử giá (price version) | Một bộ (giá thuê, cọc chuẩn) có hiệu lực TỪ một thời điểm | mới; append-only |
| Đổi giá | update-dress làm thay đổi `rentalPrice` HOẶC `depositAmount` | so với giá trị hiện tại — PATCH gửi lại đúng giá cũ KHÔNG sinh dòng |
| Giá hiện hành | dòng sử mới nhất = giá trên bảng `dresses` | bảng `dresses` vẫn là nguồn đọc nhanh; bảng sử là vết |

## 2. Use-case specification

```text
Use case: ghi sử tự động khi create/update dress + đọc lịch sử giá của một váy
Actor: ghi — bất kỳ ai được phép create/update dress (luật sinh dòng là của HỆ THỐNG,
  không phải một hành động riêng); đọc — §6.Q1
Trigger: (ghi) POST /dresses · PATCH /dresses/:id — không đổi shape request
         (đọc) GET /dresses/:id/price-history — endpoint mới

Business flow (ghi — chèn vào create/update hiện có):
  - create-dress: sau khi entity hợp lệ → INSERT dresses + INSERT dòng sử v1
    (giá khởi điểm) CÙNG transaction
  - update-dress: nếu rentalPrice/depositAmount đổi so với bản ghi hiện tại
    → UPDATE dresses + INSERT dòng sử CÙNG transaction; không đổi giá → không dòng nào

Domain rules / invariants:
  - R1 (AC1): mọi thay đổi của (rentalPrice, depositAmount) sinh ĐÚNG MỘT dòng sử,
              cùng transaction — không có trạng thái "giá đã đổi, sử chưa ghi".
  - R2 (AC2): bảng sử append-only — không endpoint sửa/xoá; sửa giá sai = đổi giá thêm
              lần nữa (dòng mới), đúng triết lý sổ của payments.
  - R3 (AC3): dòng sử ghi GIÁ TRỊ MỚI + changed_by (staff id từ request.user) + changed_at.
              Giá cũ không cần cột riêng — nó là dòng liền trước.
  - R4 (AC4): mọi váy có ≥ 1 dòng (v1 từ create; váy CŨ được backfill một dòng từ giá
              hiện tại khi migrate, changed_by NULL = "trước khi có sổ").
  - R5: purchasePrice ([purchase-price](./purchase-price.md)) KHÔNG vào bảng này —
        phạm vi đề bài là giá thuê + cọc (đổi thì là quyết định mới, §6.Q3 bên kia).

Side effects / domain events: không event mới — dòng sử là persistence của chính use case
  create/update, không phải reaction (không listener, spec 01 §8).
Idempotency: PATCH gửi lại y hệt → giá không đổi → không dòng sử mới (R1 "đổi so với hiện tại"
  tự bảo vệ replay).
Concurrency: hai PATCH đổi giá song song → last-write trên dresses (MVP, như mọi field), MỖI
  lệnh thắng vẫn sinh dòng sử của nó — sổ ghi cả hai lần đổi, thứ tự theo changed_at/id.
```

### Outcome catalog

| `status` code | Meaning | HTTP | Extra payload |
| --- | --- | --- | --- |
| *(read)* 404 dress không tồn tại | envelope như các read khác | 404 | — |

Không outcome nghiệp vụ mới: ghi sử không thể bị từ chối riêng (nó đi theo update-dress),
đọc sử là read thuần.

## 3. UI state matrix

Trang chi tiết váy thêm section **"Lịch sử giá"**:

| State | Condition | Display / action |
| --- | --- | --- |
| loading | query đang chạy | skeleton ngắn dưới info grid |
| chỉ 1 dòng | váy chưa từng đổi giá | "Giá giữ nguyên từ {date}" — một dòng, không bảng |
| ≥ 2 dòng | có đổi giá | bảng: Ngày · Giá thuê · Cọc chuẩn · Người đổi (dòng backfill: "—"); mới nhất trên cùng, đánh dấu "hiện hành" |
| error | query lỗi | inline error + Thử lại — KHÔNG chặn phần còn lại của trang chi tiết |

(empty không tồn tại — R4 bảo đảm ≥ 1 dòng.) Accessibility: bảng có caption; số tiền format
nhóm như mọi nơi. Responsive: bảng cuộn ngang trong container riêng trên màn hẹp.

## 4. FE data needs

- `GET /dresses/:id/price-history` → `{ data: [{ rentalPrice, depositAmount, changedAt,
  changedBy: { id, name } | null }] }` — BE join sẵn tên người đổi (denormalize cho màn hình,
  tránh FE tra từng id; "name" là username/display từ identity — xem §6.Q2 của
  [manage-users](../identity/manage-users.md)).
- Lazy query khi section vào viewport hoặc luôn-tải cùng trang (chi tiết đã waterfall 2 query —
  chọn khi implement, ghi lại).
- Strongly consistent (đọc thẳng bảng).

## 5. Traceability skeleton

| AC | Scenario | Planned test level |
| --- | --- | --- |
| AC1 | update đổi giá thuê → +1 dòng đúng giá trị; đổi cả hai → vẫn +1 dòng | application unit + `test:e2e` |
| AC1 | update KHÔNG đổi giá (gửi lại y hệt) → +0 dòng | application unit |
| AC1 | update giá FAIL giữa chừng → 0 dòng sử (cùng transaction — proof bằng lỗi ép trong e2e) | `test:e2e` |
| AC2 | không tồn tại endpoint sửa/xoá dòng sử | contract check khi emit |
| AC3 | dòng sử mang changed_by = staff đang đăng nhập | `test:e2e` |
| AC4 | migration backfill: mọi dress hiện có đúng 1 dòng, changed_by NULL | `test:e2e` sau migrate |
| — | create qua CSV import cũng sinh v1 (import dispatch CreateDressCommand — miễn phí) | application unit |
| — | section FE: 1 dòng vs nhiều dòng vs error | vitest (FE) |

## 6. Decisions (chủ tiệm chốt 2026-08-10 — "tôi đồng ý", toàn bộ theo gợi ý agent)

| # | Question | Quyết định |
| --- | --- | --- |
| 1 | Ai xem lịch sử giá | **Mọi staff** — sử không nhạy cảm hơn chính giá; không shaping vai |
| 2 | Lý do đổi giá | **Không** (MVP) — "ai, khi nào, bao nhiêu" là đủ |

Quyết định phái sinh (agent chốt, bác được):

| # | Vấn đề | Chốt | Vì sao |
| --- | --- | --- | --- |
| 3 | Trigger DB hay app-level cùng-transaction? | app-level trong service, e2e proof | repo để luật ở domain/app, DB làm lưới cho uniqueness/exclusion; trigger là một class cơ chế mới không ai thấy trong code Node |
| 4 | Lưu giá cũ + mới mỗi dòng? | chỉ giá mới (R3) | giá cũ = dòng liền trước; hai cột old/new là chỗ cho hai nguồn sự thật lệch nhau |
| 5 | Backfill váy cũ? | có, 1 dòng/váy, changed_by NULL (R4) | để UI không cần state "chưa có sử" và mọi váy trả lời được "giá này từ bao giờ (ít nhất từ ngày migrate)" |

## Contract check (02-contract-check.md) — chạy trên draft

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| ~~blocker~~ **đã giải quyết** | Q1 chốt: mọi staff xem — không shaping vai | §6.Q1 | read thường, không đọc role |
| major | R1 không có lưới DB — chỉ transaction kỷ luật; nếu mai này có đường ghi giá thứ hai (script?) nó sẽ lách sổ | §2 R1 | ghi rõ trong catalog-aggregate.md: MỌI đường đổi giá phải qua UpdateDress service; import CSV không update giá (chỉ create) — giữ đúng như vậy |
| major | `changedBy.name` join sang identity — cross-context read mới (deviation #4 mở rộng thêm một adapter) | §4 | StaffLookupPort + adapter đọc bảng staff_users, cùng trick DressLookupPort; ghi vào design doc |
| minor | Thứ tự dòng cùng-giây: ORDER BY changed_at, id (tie-break id) — bài học payments | §2 concurrency | ghi thẳng vào query |
| minor | Endpoint đọc nằm dưới /dresses/:id/* nhưng thuộc catalog — không cần trick @ApiTags chéo như rentals | §4 | tag catalog bình thường |

Mục 1 (naming), 3 (outcome coverage), 8 (idempotency): không có finding.

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

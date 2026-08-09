# Tactical Design — Chỉ mục & Quy trình

> Thiết kế chiến thuật per-context cho dress-rental, theo template
> `docs/spec/init-nestjs-hexagonal/14-design-first.md` §2 (quy trình nền:
> `docs/spec/init-harness/06-design-first.md`). Đây là **intent docs** — ghi quyết định và lý
> do; hiện trạng luôn là code + `packages/contract/openapi.json`. Mỗi doc mang dòng status
> `as-built <ngày>` và phải được đối chiếu lại (re-sync) sau mỗi feature design-tier merge.

## Tài liệu theo bounded context

| Context | Vai trò | Aggregate(s) | Tài liệu |
| --- | --- | --- | --- |
| `identity` | Generic (authN/authZ) | `StaffUser` (không có aggregate giàu — bảng + token service) | [identity-aggregate.md](./identity-aggregate.md) |
| `catalog` | Supporting | `DressEntity` | [catalog-aggregate.md](./catalog-aggregate.md) |
| `rentals` | **Core** | `RentalEntity` (+ child `RentalItemEntity`) | [rentals-aggregate.md](./rentals-aggregate.md) |
| `payments` | Supporting | (chưa có aggregate — bảng `payments` + read slice) | [payments-aggregate.md](./payments-aggregate.md) |
| `qr` | Supporting, planned | `QrLinkEntity` | [qr-aggregate.md](./qr-aggregate.md) |

QR admin được ship độc lập tại `apps/qr-admin/` (không phải feature của `apps/fe`); bootstrap + UX
design của nó ở [qr-admin.md](./qr-admin.md). SRS phase QR: [../SRS-qr-url.md](../SRS-qr-url.md).

Yêu cầu sản phẩm: [../SRS-dress-rental.md](../SRS-dress-rental.md) (FR/BR/NFR + bảng truy vết).

## Quyết định cross-cutting (ADR)

| ADR | Quyết định | Phạm vi |
| --- | --- | --- |
| [0001](../adr/0001-outcome-model-at-the-http-boundary.md) | Business outcome sống sót qua HTTP boundary: outcome body 422/403 vs error envelope; **outcome catalog cho toàn bộ use case** + UI state matrix | 4 context BE + `apps/fe` + `apps/qr-admin` |

ADR là nơi ghi quyết định **cross-cutting** (shape trên dây, quy ước lỗi, ranh giới context). Một
quyết định chỉ thuộc một context thì ghi trong design doc của context đó, không mở ADR.

---

## Quy trình: từ SRS → phân tích → feature → task

Chuỗi truy vết xuyên suốt, mỗi bước tham chiếu bước trước:

```
FR-id (SRS)  →  design doc §(invariant/state/contract)  →  feature id (feature_list.json)
             →  task trong session (harness)  →  evidence + commit  →  re-sync docs
```

### B1 — Yêu cầu vào SRS

Mỗi nhu cầu mới = một **FR-id** trong [SRS](../SRS-dress-rental.md), gán vào đúng MỘT context
chính (nhu cầu chạm nhiều context → một FR chủ + ghi chú các context tham gia). Rule nghiệp vụ
bất biến (không gắn màn hình cụ thể) = **BR-id**. Chưa có FR-id thì chưa có gì để thiết kế.

### B2 — Phân tích / thiết kế (design gate)

Định bậc theo `14-design-first.md`:

| Bậc | Tiêu chí (repo này) | Artifact bắt buộc |
| --- | --- | --- |
| Mechanical | Sửa lỗi trong 1 file, đổi copy/i18n | Không — description trong feature_list đủ |
| Standard | Slice CRUD theo pattern sẵn (thêm một query, một field) | INPUT CONTRACT của `10-*-scaffold-prompt.md` điền đủ, dẫn FR-id |
| **Design-tier** | Aggregate/invariant/state-transition MỚI, contract cross-context mới, concurrency-sensitive, pattern tương tác FE mới | Cập nhật design doc của context (đủ bảng invariant-enforcement) + review TRƯỚC khi code |

Invariant mới ở bậc design-tier PHẢI có đủ 2 cột: **cơ chế DB** (UNIQUE/CHECK/EXCLUDE — không
chấp nhận "app check") và **proof test** (spec 09 §Invariant proof tests). FE có màn hình
tương tác mới → thêm mục UX flow/URL-state/invalidation theo `init-react/14-design-first.md` §2.

#### B2.1 — Có từ chối nghiệp vụ → outcome catalog TRƯỚC khi code

Capability nào có **rejection / denial có tên** (không phải read CRUD thuần) thì phải có
**outcome catalog** được duyệt trước, theo `docs/spec/init-feature-spec/`
(`01-feature-spec-template.md` §2–§3):

| Tình huống | Artifact | Nơi lưu |
| --- | --- | --- |
| Capability MỚI có rejection | use-case spec đầy đủ: glossary slice, outcome catalog, UI state matrix, contract check | `docs/design/<context>/<use-case>.md`, header `status: draft \| approved \| as-built` |
| Thêm outcome vào use case đã có | thêm hàng vào catalog của [ADR 0001](../adr/0001-outcome-model-at-the-http-boundary.md) §3 + §4, và bảng invariant của context | ADR 0001 + design doc context |
| Quyết định cross-cutting (đổi shape trên dây, đổi quy ước lỗi, đổi ranh giới) | **ADR** | `docs/adr/NNNN-<slug>.md` |

Ràng buộc bắt buộc, không thương lượng:

- Code outcome là snake_case Ubiquitous Language, **ổn định sau khi approve** — đổi tên là
  breaking contract change, phải có ADR mới.
- Catalog đã duyệt được **paste nguyên văn** vào field `outcomes:` của CẢ HAI INPUT CONTRACT
  (`init-nestjs-hexagonal/10` và `init-react/10`); BE điền thêm `useCaseSpec:` trỏ tới file spec
  (bắt buộc khi `outcomes` có nhiều hơn happy path) và `idempotency:`.
- Ranh giới duy nhất giữa hai shape trên dây: **returned `Result` Err → outcome body (422/403)**,
  **thrown → error envelope**. Không tạo shape thứ ba, không dùng `GENERIC.*` cho rejection
  (ADR 0001 §2).

### B3 — Từ design ra feature

- **1 use-case slice = 1 entry `feature_list.json`**, id `<context>/<use-case>` (hạ tầng:
  `infra/<name>`); `description` dẫn FR-id + mục design doc liên quan (+ spec use-case / ADR nếu
  có ở B2.1). Brief có AC → điền `acceptance`, và evidence phải nói AC nào được lệnh nào chứng minh.
- Feature chạm API = **MỘT entry cho cả BE + contract + FE**, evidence mang proof của CẢ HAI
  phía (bất biến của root AGENTS) — không tách "BE xong" / "FE xong" thành 2 entry.
- Prerequisite phát hiện muộn = entry `todo` riêng + `dependencies`; feature hiện tại chuyển
  `blocked`, không âm thầm phình to.
- Seed tất cả ở `todo`. Kích thước chuẩn: một feature đi hết gates trong **1–2 session**;
  ước lượng quá 2 session → tách nhỏ ngay từ B3.

### B4 — Từ feature ra task (session)

Task = phần việc của MỘT session trên feature `in-progress` DUY NHẤT (luật harness). Trình tự
trong task chạm API: **BE slice → `pnpm contract` → FE slice, commit cả ba cùng nhau**.
Definition of Done = `init-harness/03` §3.4 + design gate B2 (feature design-tier không được
vào `in-progress` khi design doc chưa duyệt).

### B5 — Re-sync (đóng vòng)

Khi feature `pass`: evidence + `testedAt` vào feature_list → design doc của context nhận stamp
`as-built <ngày>` (lệch thiết kế thì ghi *deviated: gì + vì sao*) → `AGENTS.md` Current state
→ `session-handoff.md`. FR nào đổi trong lúc làm → sửa SRS **trong cùng PR** (SRS sai còn tệ
hơn không có SRS).

### Smells của quy trình

- Feature trong `feature_list.json` không truy ngược được về FR-id nào — làm thứ không ai yêu cầu.
- FR ở SRS quá 1 phase không có hàng trong bảng truy vết — yêu cầu chết, xóa hoặc lên lịch.
- Entry design-tier `in-progress` mà design doc không có diff nào gần đó — design gate bị lách.
- Bảng invariant có hàng mà cột proof-test trống qua nhiều session (BR-1/BR-2 từng như vậy suốt
  gap #5; **đã đóng 2026-08-09** bằng `apps/be/test/` + `pnpm --filter be test:e2e` — mọi hàng mới
  phải có proof test ngay, đừng để nợ lại).
- Rejection nghiệp vụ dùng chung một mã với rejection khác (kiểu 409 `GENERIC.CONFLICT` trước ADR
  0001) — FE không render được state đúng; mỗi rejection PHẢI có code riêng trong catalog.

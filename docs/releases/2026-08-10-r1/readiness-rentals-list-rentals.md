# Readiness — rentals/list-rentals: search by customer, filter by status, paginate (FR-RENT-08)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [rentals-aggregate.md](../../design/rentals-aggregate.md), as-built 2026-08-04. Status labels (`Đã đặt` / `Đang thuê` / `Đã trả` / `Đã huỷ`) live in the `rentals` AND `today` locale namespaces — a new status needs both |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (163 modules, 0 violations) / test (54, +2); FE check / lint / test (44, +5) / build; arch 11/11. Re-verified 2026-08-10 in the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `GET /rentals?q=&status=&page=&limit=` emitted with `RentalListResponseDto`; `TodayBoardDressDto` promoted to the shared `RentalDressDto` in the same change (generated-only rename, no hand-written references). Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Read-only |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-RENT-08: search by customer NAME or PHONE | `smoke.sh`: `q=Hoa` = `1:Nguyễn Thị Hoa`; `q=0912` = 1 (phone) |
| 2 | Filter by status, and junk is refused | `status=returned` = `1:VD-900` (dresses ride along); `status=weird` = 400 |
| 3 | Pagination pages over RENTALS, not item rows | `limit=2&page=2` = `2:2:4`; separate page/count/items queries joined in the projection |
| 4 | Newest first | `GET /rentals` = `4:4:Phạm Thị D` (`ORDER BY created_at DESC, id`) |
| 5 | The filter state is linkable and survives back/forward | `use-rental-filters` owns q/status/page in the URL; searching resets the page — 5 component tests |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| There is no rental DETAIL route — rows link to dresses only, and `notes` / `createdAt` are returned by the API but never shown | bangnk | _open_ — staff cannot read the note a colleague left on a rental without opening the payments dialog |
| jsdom cannot open the Radix Select popover, so the status-filter test drives the URL instead of the widget | bangnk | _open_ — the widget itself is covered only by the Playwright happy path, which does not touch the filter |

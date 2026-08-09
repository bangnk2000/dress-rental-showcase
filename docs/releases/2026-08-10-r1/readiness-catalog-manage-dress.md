# Readiness — catalog/manage-dress: create/update a dress, photo links, owner-only retire (FR-CAT-01, 03)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [catalog-aggregate.md](../../design/catalog-aggregate.md), as-built 2026-08-04, re-synced to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) 2026-08-09 (`rejected_dress_code_taken`, `rejected_dress_already_retired`). Same status-vocabulary note as [list-dresses](./readiness-catalog-list-dresses.md) |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (137 modules, 0 violations) / test (32, +8); FE check / lint / test (31, +4) / build; arch 11/11. Re-verified 2026-08-10 in the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `PATCH /dresses/:id` + `POST /dresses/:id/retire` emitted, both clients regenerated in the same change (`photoUrls` on `DressResponseDto`). Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | ok — **destructive** | `apps/be/migrations/1753830000003_dress_photos.js`; `down` = `ALTER TABLE dresses DROP COLUMN photo_urls`, i.e. reversing it deletes every photo link the shop pasted. See [rollback.md](./rollback.md) |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-CAT-03: a partial update keeps the fields it does not mention | `smoke.sh`: PATCH then GET = `Váy cưới ren trắng (sửa):2:1800000` — name, price and 2 photos changed, code and deposit untouched |
| 2 | The unique dress code holds on update, not just on create | PATCH to a taken code = 409 at the time (`rejected_dress_code_taken` 422 after ADR 0001); raw-INSERT proof in `apps/be/test/catalog-unique-code.e2e-spec.ts` |
| 3 | FR-CAT-03: retire is owner-only and one-way | `dress:retire` policy; no reactivate policy is registered and the guard is fail-closed, so reactivation is impossible by construction. Retire 200, retire again 409 |
| 4 | A retired dress cannot be booked even when its calendar is free | `smoke.sh`: availability of the retired dress on a clear future range = `false` |
| 5 | Photos are staff-pasted links, not uploads (deliberate MVP scope) | `photo_urls text[]`, http(s)-validated, max 10, one per line in the dialog |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| The owner-only 403 path was never proven with a real non-owner account — the ledger says so explicitly ("a 403 retire proof needs a non-owner user") | bangnk | _open_ — exposure: if the policy were mis-registered, a staff account could retire dresses. The fail-closed guard makes over-permission unlikely, but nothing tests it |
| Photo links point at third-party hosts; a dead link shows an empty thumbnail with no fallback | bangnk | _open_ — cosmetic, but it is the shop's only visual reference for a dress |

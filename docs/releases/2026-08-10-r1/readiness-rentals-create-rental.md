# Readiness — rentals/create-rental: book several dresses for a date range, overlap rejected by the DB (FR-RENT-01, 02)

The core capability of the product, and the one whose failure mode is a double-booked wedding dress.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [rentals-aggregate.md](../../design/rentals-aggregate.md) with its invariant-enforcement table, as-built 2026-08-04, re-synced to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) 2026-08-09 (BR-1, `rejected_dress_unavailable`) |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (116 modules, 0 violations) / test (22 incl. buffer + daterange specs); FE check / lint / test (20, +5) / build. Re-verified 2026-08-10 in the full root gate run, plus 30 BE e2e tests on real Postgres. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `POST /rentals` emitted; `useCreateRentalHttpControllerCreate` generated for the FE in the same change. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built) — but this capability has the strongest independent proof in the repo, because `infra/invariant-proof-e2e` later re-proved it at the database level |
| Migration has a rollback plan | no-migration | Uses `rentals` / `rental_items` from `1753830000002_rentals_payments.js` (`infra/be-bootstrap`), including the `rental_items_no_overlap` EXCLUDE constraint |
| Observability for new behavior | missing | [§0](./release-plan.md) R1. The watch list makes `rejected_dress_unavailable` a step-9 signal, read by eye from the log |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-RENT-01: one rental holds a customer and SEVERAL dresses over an inclusive date range | `smoke.sh` 08-01..08-03 = 201; `RentalPeriod` value object; item price defaults to the dress's standard price |
| 2 | FR-RENT-02 / BR-1: a dress cannot be booked twice for overlapping days | `smoke.sh` overlap = 409 (422 `rejected_dress_unavailable` after ADR 0001); `apps/be/test/rentals-overlap.e2e-spec.ts` asserts it over real HTTP |
| 3 | The 2-day cleaning buffer blocks the calendar, not just the rented days | 08-04..08-06 rejected (buffer only), 08-06..08-07 accepted (past the buffer); stored `blocked_period` = period + 2 days |
| 4 | The DATABASE is the enforcer, not the application pre-check | psql INSERT bypassing the app is rejected by `rental_items_no_overlap`; two concurrent identical POSTs yield exactly `[201, 422]` with ONE row (`infra/invariant-proof-e2e` AC2) |
| 5 | Bad input is refused before it reaches the domain | unknown dress = 404, `end < start` = 400 |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| `CLEANING_BUFFER_DAYS` is an env value (default 2) with no UI and no per-dress override — production must set it to what the shop actually does | bangnk | _open_ — exposure: too small and a dress is promised before it is clean; too large and the shop loses bookings it could serve |
| No `Idempotency-Key`: a double-submitted booking form is stopped by the DB constraint, not by request identity | bangnk | _open_ — deliberate deviation (`apps/fe/AGENTS.md` #8). The user-visible effect of a double submit is a rejection message, not a duplicate booking |
| The deposit is never RECORDED at booking time — `payments` only receives settlement rows | bangnk | _open_ — the shop takes deposit cash on day 1 with no row in the system until return. Known gap, carried from `payments/list-payments` |

# Readiness — rentals/availability-check: "is this dress free from A to B", plus the dress calendar (FR-RENT-03)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [rentals-aggregate.md](../../design/rentals-aggregate.md) + [catalog-aggregate.md](../../design/catalog-aggregate.md) (the `GET /dresses/:id` read), as-built 2026-08-04 |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (130 modules, 0 violations) / test (24, +2 projection specs); FE check / lint / test (27) / build; arch 11/11. Re-verified 2026-08-10 in the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | Three read endpoints emitted (`GET /dresses/:id`, `/dresses/:dressId/booked-ranges`, `/dresses/:dressId/availability`), suspense hooks generated for the FE. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Read-only over existing tables |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-RENT-03: the answer uses the SAME rule the booking uses, buffer included | The check extends the asked period by `CLEANING_BUFFER_DAYS` and tests it against blocking `blocked_period`s — the create-rental precondition, mirrored |
| 2 | The candidate's own buffer counts, not only the existing booking's | `smoke.sh`: 08-16..08-17 = `true`; 08-17..08-18 = `false:1` — the candidate's buffer reaches the 08-20 booking |
| 3 | A retired dress is never available, however clear its calendar | `smoke.sh` on a retired dress with a free future range = `false` |
| 4 | The dress page shows WHY a day is blocked | `booked-ranges` returns 3 ranges with `blockedUntilDate` = `2026-08-05` (the buffer materialized); the FE calendar shades rented vs buffer vs free |
| 5 | Bad input is a 4xx, not a 500 from a `::date` cast | `end < start` = 400; unknown dress = 404 |

A latent bug was fixed here and is worth carrying into production knowledge: slonik returns PARSED
range objects rather than literals, so every range `SELECT` now casts `::text`. A future range query
that forgets the cast will fail in a way that looks like a data problem.

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| The availability answer is a point-in-time read with no hold: two staff members can both be told "free" and one loses at submit | bangnk | _open_ — the loser sees `rejected_dress_unavailable` rather than a double booking, which is the correct failure. On one shared tablet the window is nearly zero |
| No e2e covers calendar month navigation (ledger says so) | bangnk | _open_ — a navigation bug would misinform staff about a future month; the underlying data endpoint is tested |

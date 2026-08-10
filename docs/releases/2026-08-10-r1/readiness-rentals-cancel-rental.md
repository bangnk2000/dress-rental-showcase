# Readiness — rentals/cancel-rental: cancel a booking and free the calendar (FR-RENT-06)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [rentals-aggregate.md](../../design/rentals-aggregate.md), as-built 2026-08-04, re-synced to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) 2026-08-09 (`rejected_cancel_not_allowed` + `currentStatus`) |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (167 modules, 0 violations) / test (58, +4); FE check / lint / test (46, +2) / build; arch 11/11. Re-verified 2026-08-10 in the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `POST /rentals/:id/cancel` emitted, client regenerated in the same change. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Flips `rental_items.blocking` on existing rows |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-RENT-06: cancelling frees the calendar AT THE DATABASE LEVEL, not just in a status column | `smoke.sh`, end to end: booked 10-01..10-02 → availability `false` → cancel 200 → availability `true` → **rebook of the same dress and dates = 201**, because the EXCLUDE constraint ignores non-blocking rows |
| 2 | Only a `booked` rental can be cancelled | An `out` rental (after pickup) = 409 — it must be RETURNED; re-cancel = 409; unknown = 404 |
| 3 | History is kept, not deleted | `GET /rentals?status=cancelled` = 1 |
| 4 | A cancelled rental disappears from the today board too | The FE mutation invalidates BOTH the list and the board parameterless keys — the board is shared across devices |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| Cancel is irreversible — there is no un-cancel, and the freed days may be taken by someone else within seconds | bangnk | _open_ — the only guard is a `window.confirm`. A mis-tap on the counter tablet loses a booking |
| Cancelling records no reason and no money consequence: a deposit already taken in cash has no trace in the system | bangnk | _open_ — same root gap as the unrecorded deposit collection |
| The board's due-out cards offer no cancel action (list only) | bangnk | _open_ — staff must navigate away from the morning screen to cancel |

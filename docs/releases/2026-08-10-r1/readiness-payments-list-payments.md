# Readiness — payments/list-payments: the money movements of a rental (FR-PAY-01)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [payments-aggregate.md](../../design/payments-aggregate.md), as-built 2026-08-04. Movement kinds: `deposit`, `deposit_refund`, `late_fee`, `damage_fee` — three of the four labels exist in the UI before any code writes them |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (175 modules, 0 violations) / test (60, +2); FE check / lint / test (48, +2) / build; arch 11/11. Re-verified 2026-08-10 in the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `GET /rentals/:rentalId/payments` emitted under a NEW `payments` tag (`PaymentDto`, `PaymentListResponseDto`); both clients regenerated. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Reads the `payments` table from `1753830000002_rentals_payments.js` |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-PAY-01: a rental's movements are listed with kind, amount, note and date | `smoke.sh`: returned rental = `2:deposit_refund:2800000:late_fee:200000` |
| 2 | The order is deterministic even though a settlement writes its rows in ONE transaction | `ORDER BY created_at, kind, id` — `kind` breaks the identical-timestamp tie |
| 3 | An unsettled rental returns an empty list, an unknown rental a 404 | `0` and `404` respectively; existence is checked via `RentalLookupPort` (SQL on the rentals table, no cross-context code import) |
| 4 | Staff can see the movements without leaving the list | Lazy dialog query, enabled only while open; empty state covered by component tests |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| **The deposit COLLECTION is never recorded.** The list shows settlement rows only, so a refund appears with no matching deposit and the shop cannot reconcile cash from this screen | bangnk | _open_ — the single biggest functional gap going into production; the payments context has no write use case of its own |
| The payments button appears only on `returned` rows | bangnk | _open_ — an in-progress rental's money history is unreachable in the UI |
| No export and no per-day or per-period totals | bangnk | _open_ — the shop's accounting still happens outside the system |

# Readiness — rentals/return-rental: pickup, return and settlement (FR-RENT-05)

The only path in the product that writes money rows. Treat its readiness as the release's centre of
gravity.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [rentals-aggregate.md](../../design/rentals-aggregate.md) (state machine) + [payments-aggregate.md](../../design/payments-aggregate.md) (movement kinds), as-built 2026-08-04, re-synced to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) 2026-08-09 (`rejected_pickup_not_allowed`, `rejected_return_not_allowed` with `currentStatus`) |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (156 modules, 0 violations) / test (52, +8); FE check / lint / test (39, +4) / build; arch 11/11. Re-verified 2026-08-10 in the full root gate run + 30 BE e2e. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `POST /rentals/:id/pickup` and `POST /rentals/:id/return` emitted with `ReturnRentalRequestDto`; both clients regenerated in the same change. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built) — later strengthened by `rentals/settle-late-fee`, which added real ACs over the same endpoint |
| Migration has a rollback plan | no-migration | Writes to `payments` from `1753830000002_rentals_payments.js` |
| Observability for new behavior | **missing — and this is the row to argue about** | [§0](./release-plan.md) R1. Nothing watches settlement writes. The trade-off below (status flips before payments land) is exactly the kind of failure a metric would catch and a human will not |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-RENT-04/05: `booked → out → returned`, and a skipped pickup still allows a return | 8 unit specs; `smoke.sh`: pickup 200, re-pickup 409, return 200, re-return 409 |
| 2 | Settlement writes exactly the movements that happened | psql after a return with `{lateFee:200000, damageFee:0, depositRefund:2800000}`: exactly `late_fee 200000` + `deposit_refund 2800000` — the zero damage fee wrote NO row; the note rides on both |
| 3 | One settlement is one transaction | `PaymentRecorderAdapter` writes the payments table in a single transaction per settlement |
| 4 | A returned rental leaves the board; a late one stays visible | Board empties after return; the overdue list shows `1:out` on 08-04 for a rental ending 08-03 |
| 5 | Negative or unknown input is refused | negative fee = 400; unknown rental = 404 |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry — the first row is the sharpest risk in the release:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| **Ordering trade-off:** the rental status flips to `returned` BEFORE the payment rows land. A recorder failure leaves a returned rental with no money rows — recoverable only by re-entering the amounts by hand, and nothing alerts anyone | bangnk | _open_ — the documented reasoning is that the opposite order (fees on an unreturned rental) is worse. Exposure: silent money loss in the record, discovered at the next reconciliation |
| Early return does NOT shrink `blocked_period` — days the shop could re-sell stay blocked through the original buffer | bangnk | _open_ — lost revenue, not incorrect data. Known and deliberate |
| "Dress moves to cleaning then available" is DERIVED from the buffer, never written as a dress status | bangnk | _open_ — matches the catalog's `active/retired` model; the SRS wording still implies a status field |
| The deposit COLLECTION at booking is still unrecorded, so a settlement's `deposit_refund` has no counterpart row | bangnk | _open_ — the ledger reads as refunds without deposits until that gap is closed |

# Readiness — rentals/settle-late-fee: auto-computed late fee with an owner-only waiver (FR-RENT-09)

The only capability in this release whose business rules were approved by the shop owner in writing
BEFORE the code existed — and the only one that charges the customer money the app computed itself.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | **ok (full spec-before-code lane)** | [settle-late-fee.md](../../design/rentals/settle-late-fee.md): drafted at status `draft` with the fee formula and waiver authority left as BLOCKER questions, contract-checked on the draft (2 blockers, 2 major, 2 minor), answered by the shop owner in §6, then flipped to `approved`, then implemented, then re-synced as-built in §7. Its two new outcomes were added to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) §3–§4 before implementation |
| All harness gates green | ok | `testedAt` 2026-08-10: be 95 unit + 30 e2e (8 new in `test/late-fee.e2e-spec.ts`), fe 57 (4 new dialog states), qr-admin 13, root check / lint / arch / builds green, Playwright happy path green against the real stack. Contract regenerated for both clients in the same commit |
| Contract evidence: provider + consumer tests | ok (type-level) | `GET /rentals/:id/late-fee` plus the 403/422 outcome shapes on the return endpoint are in the contract; both clients regenerated in the same commit. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | **ok** | 4 ACs, each with named evidence — see below |
| Migration has a rollback plan | no-migration | Reuses the `payments` table; `lateFee` changed MEANING in place (owner-accepted, spec §6) rather than gaining a column |
| Observability for new behavior | **missing — highest-stakes instance of R1** | [§0](./release-plan.md). Nothing counts `late_fee_waiver_requires_owner` denials or compares charged vs suggested amounts. A systematic pricing error shows up as customer complaints |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3); the shop owner is the authority for the RULE itself (spec §6) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| AC1 | `daysLate` and the suggested fee follow the formula approved in spec §6 Q1–Q3 (cleaning buffer excluded), computed as a pure function | `domain/late-fee.value-object.ts` with 8 unit tests incl. buffer-irrelevance and month boundaries, reached through `RentalEntity.lateFeeQuote()`. The reference day is `shopToday()` in `Asia/Ho_Chi_Minh`, so money never depends on the VPS clock |
| AC2 | Returning without `lateFee` charges the suggestion; `payments` records what was actually charged | Unit test + e2e: a 2-day, 1-dress overrun writes a `late_fee` row of 400,000 |
| AC3 | Charging LESS than suggested is refused for staff with `403 { status: 'forbidden', reason: 'late_fee_waiver_requires_owner', suggestedLateFee, submittedLateFee }`, and accepted for the owner (who must give a reason) | `test/late-fee.e2e-spec.ts` over real HTTP: the 403 leaves the rental `out` with NO payments row; an owner waiver without a note = 422 `rejected_waiver_note_required`; with a note the reduced amount is recorded; staff charging exactly or more still succeeds |
| AC4 | The dialog shows days late and the suggested amount BEFORE submit, pre-filled and editable, with a fallback when the quote call fails | 4 new vitest cases: `aria-live` banner ("Trễ 3 ngày · 2 váy → đề xuất 1.200.000 ₫"), submit disabled until the quote lands, both waiver rejections keep the dialog open with the note focused, manual entry when the quote fails |

Read and write use the SAME domain method — the quote endpoint does not grow a second copy of the
rule in SQL. Waiver authority is checked AFTER the state machine decides, so an already-returned
rental still answers `rejected_return_not_allowed` rather than a fee complaint.

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| `LATE_FEE_PER_DRESS_PER_DAY` is an env value (200,000 ₫ default): changing the shop's price needs a deploy, and a wrong value silently mis-charges every late return | bangnk | _open_ — verify it in the production `.env` at release step 6, and re-verify after any redeploy |
| The rule has no grace period and no cap, by the owner's explicit decision — a dress forgotten for a month bills a month | bangnk | _open_ — approved in spec §6 Q1–Q2; staff need to know the waiver exists and that only the owner can apply it |
| A pre-existing side effect fixed here is worth watching: `lib/format.ts` used to read the i18n singleton and formatted money en-style under test while the UI was vi. It now reads `<html lang>` | bangnk | _open_ — no test asserted formatted currency before, which is why it hid for so long; currency rendering is now covered only by the new dialog cases |

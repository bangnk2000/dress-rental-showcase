# Readiness — rentals/today-board: the screen staff open every morning (FR-RENT-04, 07)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [rentals-aggregate.md](../../design/rentals-aggregate.md), as-built 2026-08-04. Vocabulary in production use: *Giao váy cho khách* (due out), *Nhận váy về* (due back), *Quá hạn* (overdue) |
| All harness gates green | ok | Ledger (2026-07-30): BE build / lint / arch (145 modules, 0 violations) / test (44, +3 projection specs); FE check / lint / test (35, +4) / build; arch 11/11. Re-verified 2026-08-10 in the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `GET /rentals/today-board?date=` emitted with `TodayBoardResponseDto`; suspense hook generated. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Read-only |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-RENT-07: today's hand-outs and take-backs, each with customer and dress codes | `smoke.sh`: 2026-08-01 = `1:0:VD-900`, 2026-08-03 = `0:1` |
| 2 | A single-day rental appears on BOTH lists, as the same rental | 2026-09-20 = `1:1:true` (same `rentalId`) |
| 3 | Returned and cancelled rentals never appear | Quiet day = `0:0`; board empties after a return |
| 4 | Late returns stay visible instead of vanishing | The overdue section: 2026-08-04 = `1:out` for a rental ending 08-03 |
| 5 | An impossible date is a 400, not a 500 from the `::date` cast | `2026-02-30` = 400; no `date` at all = 200 (server-today default) |
| 6 | The board follows the DEVICE's day, not the server's | The FE always sends `?date=` from `local-date.ts`; a UTC server would otherwise flip the day at 07:00 Hanoi. The Playwright run pins the browser to `Asia/Ho_Chi_Minh` for the same reason |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| Two clocks decide "today": the board uses the DEVICE date, the late fee uses `shopToday()` in `Asia/Ho_Chi_Minh` (FR-RENT-09). A tablet with a wrong timezone shows the wrong board while charging the right fee | bangnk | _open_ — mitigation is checking the counter tablet's timezone at step 8; nothing in the app detects the mismatch |
| The board has no cancel action (list only) and no auto-refresh — a change made on another device is seen after a 60s stale window or a manual reload | bangnk | _open_ — one shared tablet makes this nearly invisible; two devices make it real |

# Session Handoff

Newest first. On resume read ONLY the first entry. Close: prepend one entry (Done / Proof / Next /
Watch out, ≤ ~8 lines — detail belongs in the ledger evidence or the design doc), then keep at most
5 entries here: move the oldest, verbatim, to the top of
[`docs/harness/session-handoff-archive.md`](docs/harness/session-handoff-archive.md) (history only),
prefixing its relative link targets with `../../`.

## 2026-11-07 (56) — every staff member may edit a rental (`rentals/update-rental-by-staff` = pass)

- Done: owner ask "Mở tính năng sửa đơn cho nhân viên", scope = "Sửa tất cả như chủ" (discount included). `rental:update` → any staff; OpenAPI loses the 403 (description only, contract regenerated); FE shows Sửa đơn to all, edit route has no role redirect. update-rental §6 Q1 + Q8 resolved (§8 amendment, SRS FR-RENT-13, aggregate doc, ADR note). Ledger 54/54.
- Proof: `bash init.sh` all green; be e2e 175 (AC5 now: staff PATCH 200), fe vitest 181.
- Next: bangnk — merge PR #40 then this PR; deploy **be → fe** (no migration) — can ride the same run as #39 (deposit-at-pickup). update-rental §6 Q2–Q7, Q9 still open.
- Watch out: keep be → fe order — the new FE on the old BE shows staff a button that 403s.

## 2026-11-07 (55) — PR #38 found live, PR #39 merged and held (docs/harness only)

- Done: owner merged PR #38 + #39. The owner had already shipped #38 at 17:21 (deploy run 42363551332, target `1067bc1`, backup + R2, migrations 1755800000000/1 up, verify green) → `rentals/cancel-with-refund` `deploy.deployed` + Production bullet. Owner chose NOT to deploy #39 yet. Corrected the deposit-at-pickup evidence: the cancel-dialog fix a980ffc ships with #39, not #38.
- Proof: `ledger.mjs check` OK; `pending` → only `rentals/deposit-at-pickup` undeployed (be → fe).
- Next: bangnk — when ready, Actions → deploy `only=auto` (target `67f0e3c` or later), then reload the CMS on every shop device before the first handout and tell staff existing bookings need a deposit at pickup (§6.Q6); then `deploy.deployed` + Production bullet. Q1–Q9 of update-rental §6 still open.
- Watch out: before #39 ships, the live cancel dialog still shows each rejection twice (a980ffc not live).

## 2026-11-07 (54) — deposit at booking + deposit gate at pickup (`rentals/deposit-at-pickup` = pass)

- Done: PR #38 (cancel-with-refund) merged by owner. Built FR-RENT-14: create form records rental fee (pre-filled) and deposit (unticked box) with the rental; a booking with no deposit on file cannot be handed out — the board marks it "Chưa thu cọc" and pickup opens "Thu cọc & giao váy" (deposit written with the handover, under the row lock). Also fixed the cancel dialog's double toast (merged, undeployed). Ledger 53/53.
- Proof: `bash init.sh` all green; be e2e 175 (new deposit-at-pickup suite incl. no-orphan create race and pickup↔collect race), fe vitest 180.
- Next: PR from `feat/deposit-at-pickup` → Codex review → owner merges; deploy **migrate → be → fe** for BOTH cancel-with-refund and deposit-at-pickup (`ledger.mjs pending`). Tell staff: existing bookings without a deposit now need one at pickup (§6.Q6).
- Watch out: local Playwright stops at sign-in on the dev DB (owner password ≠ CI seed `changeme`); CI `e2e` is the proof. Every mutation that renders its own rejections needs `onError: () => undefined` (app/providers.tsx toasts globally).

## 2026-11-07 (53) — cancel a prepaid booking with refunds (`rentals/cancel-with-refund` = pass)

- Done: owner asked for "thu cọc khi tạo đơn + nhắc cọc khi giao váy"; two design-tier specs written and owner-approved — [`deposit-at-pickup`](docs/design/rentals/deposit-at-pickup.md) (rules approved, prototype pending) and its prerequisite [`cancel-with-refund`](docs/design/rentals/cancel-with-refund.md) (as-built). Built cancel-with-refund: migration 1755800000000 (`rental_fee_refund`), refunds in the cancel transaction, 4 new outcomes, ONE kernel cancel dialog + `api/use-cancel-rental.ts` on board/list/detail. Ledger 52/52.
- Proof: all root gates green; be e2e 160 (new suite: race collect↔cancel, raw SQL CHECK, migration down/up), fe vitest 173.
- Next: PR from `feat/cancel-with-refund` (holds both specs) → merge; deploy **migrate → be → fe** (`ledger.mjs pending`). Then `deposit-at-pickup`: prototype round, then build (Q3 = hard block at pickup → new outcome `rejected_deposit_not_collected`).
- Watch out: outcome payload keys must never be `kind` — `mapApiError` overwrites it (hence `refundKind`). Kernel may not import `@/api`; shared data hooks go in `src/api/`. PowerShell eats `&` and backticks in inline bash — use script files.

## 2026-10-31 (52) — first green GitHub Actions deploy (`infra/deploy-actions` = pass)

- Done: run 1 (7b8d244) failed at web — Cloudflare Bot Fight Mode challenged the runner IP. Owner kept Bot Fight Mode; PR #36: web.sh builds through `ssh -L 3000:127.0.0.1:3000`, verify.sh checks nginx on the VPS + origin-by-IP 000 from the runner; WSL `harden-remote.sh` sshd now `AllowTcpForwarding local` + `PermitOpen 127.0.0.1:3000` (owner re-ran harden.sh). Run 41101946604 (5cd5646) green end to end; `.deployed` written by the workflow. Also found PR #30/#31 had been live since 2026-10-28 (`c00f926`) — ledger + Production bullet corrected.
- Proof: ledger evidence of `infra/deploy-actions` (all verify lines, tunnel catalogue 99, 109 pages).
- Next: routine deploys = Actions → deploy with `only=auto`. The release-lane debt (r2 R1–R11, un-packed features) is unchanged.
- Watch out: verify from the runner no longer sees the Cloudflare edge — after Cloudflare changes run WSL `verify-external.sh`. `remote/build-remote.sh` + `backup-remote.sh` exist in repo AND in ~/deploy-dress (keep in step or retire the WSL copies). Node 20 action deprecation + ubuntu-latest → 26 annotations on every run (ci.yml too) — bump actions in one go later.


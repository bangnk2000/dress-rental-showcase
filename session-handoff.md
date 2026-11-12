# Session Handoff

Newest first. Resume: `node scripts/ledger.mjs brief` prints ONLY the first entry — don't read this
file. Close: prepend + rotate per [`clean-state-checklist.md`](clean-state-checklist.md) §State
(archive: [`docs/harness/session-handoff-archive.md`](docs/harness/session-handoff-archive.md)).

## 2026-11-12 (58) — agent docs on a diet (docs/harness only, no ledger entry)

- Done: owner ask "tối ưu lại bộ tài liệu agent đọc… mỗi phiên bắt đầu phải đọc ít nhất nhưng vẫn giữ đúng rule". Root AGENTS.md 12.0 → 7.0 KB: new §Start of session + §Route by task replace the spec bullet list and the history in Current state; "Which doc to update" + handoff rotation moved into clean-state-checklist.md (now the one close procedure). New `node scripts/ledger.mjs brief` = summary + newest handoff entry (~2 KB) — resume no longer reads this file. App AGENTS.md trimmed (fe #5 detail → apps/fe/e2e/README.md; web search mechanics → search-dresses.md §8); deviation numbers and §Screen rules kept. claude-progress.md order repaired (lines moved verbatim).
- Proof: rule inventory in the PR (every MUST/never line of the old files mapped, grep-checked); link check 0 broken; `ledger.mjs check` OK; docs/spec SHA256SUMS OK; no generated/contract diff. `bash init.sh` NOT run locally (docs + `ledger.mjs` only) — CI on the PR is the gate proof.
- Next: `fe:rental-form-ux` is `in-progress` on branch `feat/rental-form-ux` (not on master, so `brief` here says none) — it is the next session's work. Merge order: this docs PR first, then rebase `feat/rental-form-ux` onto master before that session closes (it conflicts on fe #5 and on the re-ordered claude-progress.md; keep the new #5 stub — e2e/README.md already says "every spec except phone-layout").
- Watch out: that branch's close entry is (59), not (58). The user-scope `harness-session` skill was not changed (shared with other repos); `brief` is what its "read the latest handoff entry" step means here.

## 2026-11-12 (57) — the CMS on a phone (`fe:mobile-ux` = pass)

- Done: owner ask "điều chỉnh và cải thiện UI/UX của phần cms và tương thích tối với giao diện điện thoại". Design-tier, [`cms-mobile-ux`](docs/design/cms-mobile-ux.md) agent-default (D1–D6 → ownerPending) + NFR-06. One DOM everywhere: sticky header + scrollable nav strip, stacking PageHeader, dialogs capped at 100dvh and scrolling, `pointer-coarse` 44px targets, `<Table stacked>` on every list, today-board bar/card actions wrap, toast top-centre on phones. Ledger 55/55.
- Proof: `bash init.sh` green; be e2e 175; fe vitest 185; Playwright `phone` project 14/14 + desktop happy path (local throwaway DB; CI `e2e` now runs both projects).
- Next: bangnk — try it on the shop phones and confirm/reject D1–D6 (`ledger.mjs pending`). Deploy: fe only, no migration — but master's fe also carries #39 + update-rental-by-staff, which need **be first**; ship all with `only=auto` (be → fe).
- Watch out: never add a breakpoint-duplicated DOM (table + cards, second nav) — jsdom and `toHaveCount` both see both copies (apps/fe/AGENTS.md §Screen rules). Not checked on real iOS Safari.

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

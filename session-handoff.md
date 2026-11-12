# Session Handoff

Newest first. Resume: `node scripts/ledger.mjs brief` prints ONLY the first entry — don't read this
file. Close: prepend + rotate per [`clean-state-checklist.md`](clean-state-checklist.md) §State
(archive: [`docs/harness/session-handoff-archive.md`](docs/harness/session-handoff-archive.md)).

## 2026-11-12 (62) — versioned deploys + no-build rollback (`infra/deploy-versioning` = pass)

- Done: NFR-07 shipped (PR #48, `87b6c00`): `deploy` bump input → tag vX.Y.Z + Release after verify, `.deploy-history`, one `.prev` build per part with sha/version/ops/lock/env metadata, Actions → `rollback` (swap + pm2 restart, refuses across migration / lockfile / env change), CMS footer version, plan.sh ignores AGENTS.md/README.md. Bootstrapped v1.0.0 = d2fbfb0; production now **v1.0.1**.
- Proof: offline suite 20/20 (CI `deploy-scripts`); init.sh green; Playwright 20/20; live drill deploy v1.0.1 → rollback (swap 5 s) → rollback (7 s), verify green each.
- Next: bangnk — A10 (agent docs never rebuild a part), A11 (version label in the footer) via `ledger.mjs pending`; update-rental Q2–Q7, Q9 still open. Use `bump=minor` for a feature/migration deploy.
- Watch out: a refusal path was proven offline only. WSL fallback builds carry sha=unknown (never swapped back); WSL build-remote.sh copy synced, sync.sh appends history.

## 2026-11-12 (61) — owner decisions + production `d2fbfb0` (docs/ledger, deploy only)

- Done: owner chose "as proposed" for rental-form-ux E1–E5 (PR #46) and mobile-ux D1–D6; approved deploy-versioning A1–A9 ("code luôn"). Found the ledger stale: deploy run 42384818412 (2026-11-07 15:07 UTC) had already shipped `bbf1421` = #39 deposit-at-pickup + #41 update-rental-by-staff — `deploy.deployed` back-filled. Deployed `d2fbfb0` (run 43153614172, be+fe+web, no migration): mobile-ux + rental-form-ux live.
- Proof: deploy verify all ok (fe/api/web status codes, pm2 online, migrations 15); VPS disk 27G free of 40G, web standalone 67M, fe dist 1.1M.
- Next: `infra/deploy-versioning` code (design approved). Tell staff: a booking without a deposit must collect it at pickup (live since 2026-11-07).
- Watch out: plan.sh treats apps/be/AGENTS.md / apps/web/AGENTS.md doc edits as BE/web changes (API restarted for docs) — candidate fix inside deploy-versioning.

## 2026-11-12 (60) — deploy versioning + fast rollback designed (`infra/deploy-versioning` = todo, docs only)

- Done: owner ask "thiếu việc đánh version release để xác định version đã deploy và có thể revert nhanh khi code lỗi". Design-tier draft [`deploy-versioning`](docs/design/deploy-versioning.md) + NFR-07: SemVer tag per full deploy (bump input, default patch; v1.0.0 = 1067bc1), append-only `.deploy-history`, one `.prev` slot per part, a `rollback` workflow that swaps slots + restarts pm2 without building (refuses across a migration / lockfile / build-script change), CMS version label. O1–O6 owner-chosen; A1–A9 + O3 → ownerPending.
- Proof: `ledger.mjs check` OK, stale-status OK. No code.
- Next: bangnk — approve/reject A1–A9 and confirm v1.0.0 = 1067bc1 (`ledger.mjs pending`); flip the doc's Status to approved, then open the entry (§6: measure VPS disk first, seed v1.0.0 metadata before the first versioned deploy).
- Watch out: the design gate blocks `in-progress` while the doc says draft (`ledger.mjs check`).

## 2026-11-12 (59) — rental form in four sections + a summary that stays in view (`fe:rental-form-ux` = pass)

- Done: owner ask "màn hình tạo sửa đơn thuê … cần cải thiện UI/UX cả web pc và mobile"; design-tier [`rental-form-ux`](docs/design/rental-form-ux.md) P1–P4 approved, E1–E5 agent-default (ownerPending). Sections Khách hàng / Ngày thuê / Váy / Thanh toán; ONE summary element — sticky right column from lg, fixed bottom bar with payable + submit below lg. Branch rebased onto #43 (kept master's fe #5 stub). Ledger 56/56.
- Proof: `bash init.sh` green; be e2e 175; fe vitest 191; Playwright 20/20 (chromium happy path + rental-form-desktop, phone 18) on a throwaway DB.
- Next: bangnk — try the form on a shop phone + PC, confirm/reject E1–E5. Deploy: fe only, no migration — rides the held be → fe run with #39 + update-rental-by-staff + fe:mobile-ux (`only=auto`).
- Watch out: the summary is ONE DOM node (no breakpoint copy); `zz-screens.spec.ts` (owner screenshots) is temporary and never committed.

## 2026-11-12 (58) — agent docs on a diet (docs/harness only, no ledger entry)

- Done: owner ask "tối ưu lại bộ tài liệu agent đọc… mỗi phiên bắt đầu phải đọc ít nhất nhưng vẫn giữ đúng rule". Root AGENTS.md 12.0 → 7.0 KB: new §Start of session + §Route by task replace the spec bullet list and the history in Current state; "Which doc to update" + handoff rotation moved into clean-state-checklist.md (now the one close procedure). New `node scripts/ledger.mjs brief` = summary + newest handoff entry (~2 KB) — resume no longer reads this file. App AGENTS.md trimmed (fe #5 detail → apps/fe/e2e/README.md; web search mechanics → search-dresses.md §8); deviation numbers and §Screen rules kept. claude-progress.md order repaired (lines moved verbatim).
- Proof: rule inventory in the PR (every MUST/never line of the old files mapped, grep-checked); link check 0 broken; `ledger.mjs check` OK; docs/spec SHA256SUMS OK; no generated/contract diff. `bash init.sh` NOT run locally (docs + `ledger.mjs` only) — CI on the PR is the gate proof.
- Next: `fe:rental-form-ux` is `in-progress` on branch `feat/rental-form-ux` (not on master, so `brief` here says none) — it is the next session's work. Merge order: this docs PR first, then rebase `feat/rental-form-ux` onto master before that session closes (it conflicts on fe #5 and on the re-ordered claude-progress.md; keep the new #5 stub — e2e/README.md already says "every spec except phone-layout").
- Watch out: that branch's close entry is (59), not (58). The user-scope `harness-session` skill was not changed (shared with other repos); `brief` is what its "read the latest handoff entry" step means here.


# Session Handoff

Newest first. On resume read ONLY the first entry. Close: prepend one entry (Done / Proof / Next /
Watch out, ≤ ~8 lines — detail belongs in the ledger evidence or the design doc), then keep at most
5 entries here: move the oldest, verbatim, to the top of
[`docs/harness/session-handoff-archive.md`](docs/harness/session-handoff-archive.md) (history only),
prefixing its relative link targets with `../../`.

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

## 2026-10-30 (51) — production deploy as a GitHub Actions workflow (`infra/deploy-actions` = in-progress)

- Done: RUNBOOK §7 ported into `infra/deploy/*.sh` + manual `.github/workflows/deploy.yml` (plan from the diff against `.deployed`, proven backup before a migration, BE built on the VPS, fe/web on the runner, strict verify, `.deployed` written last). WSL `~/deploy-dress/tencent` stays the fallback + one-off work. See `infra/deploy/README.md`.
- Proof: plan.sh 11 fake-ssh cases (ledger evidence), shellcheck + actionlint clean. No real run yet.
- Next: bangnk — merge; add repo secrets DEPLOY_HOST / DEPLOY_SSH_KEY / DEPLOY_KNOWN_HOSTS + the key's public half on the VPS; check `/opt/dress-rental/.deployed`; first dispatch attended, evening, `only=all backup=always` (ships PR #30 migrate→be and #31 be→web). Green → entry pass, `deploy.deployed` on both, Production bullet.
- Watch out: this entry holds the one in-progress slot until that first run. Copies of `build-remote.sh`/`backup-remote.sh` now live in two places — keep in step or retire the WSL ones.

## 2026-10-30 (50) — spec re-sync 2026.10.30: owner control plane + ledger tool (docs/harness only)

- Done: vendored all seven sets from knowledge-system `518495c` (git archive, PR knowledge-system#1 — NOT merged yet) + `docs/spec/SHA256SUMS` checked in CI `harness`; `scripts/ledger.mjs` → reference version (adds `pending`, `stale-status`, strict lint on `tier` entries); `ownerPending` = the 9 §6 defaults on `rentals/update-rental` (spec now `agent-default`); `deploy` on PR #30/#31 entries; SRS §7 status column dropped (2 rows were stale); CODEOWNERS + PR template. Ledger 50/50, no feature work.
- Proof: `ledger.mjs check` OK (0 strict); `pending` → 9 owner decisions + 2 undeployed with order; `sha256sum -c` clean, and a deliberate edit to a vendored file → detected; relative links in docs/spec all resolve.
- Next: bangnk — (1) turn on branch protection for master: PR required + CI jobs required, no force-push; (2) answer `pending` (Q1–Q9 of update-rental §6); (3) after knowledge-system#1 merges, re-sync from the merge commit if it differs from `518495c`. Deploy PR #30 → #31 still per `pending` order.
- Watch out: existing `Deviation #N` lines in `apps/*/AGENTS.md` have no upstream reference yet (new rule in upstream prompts/README §Versioning) — record them upstream at the next re-sync. Re-sync must run in a Linux shell (GNU sed); WSL login shell is fish → `wsl.exe --exec bash <script>`.

## 2026-10-27 (49) — base dress code on public listings (`catalog:public-base-code` = pass)

- Done: owner ask "hiện thị thêm mã váy gốc" → `codes: string[]` on the public Summary/Detail DTO (distinct bases of active dresses, `DressCode.baseOf`), contract regenerated, web card "Mã VAY1" + detail "Mã váy: VAY1". R6 amended in `docs/design/catalog/public-listing.md` §Amendment 2026-10-27. Ledger 50/50.
- Proof: be jest 290, web vitest green, be e2e 150 on real Postgres (public-catalog 8/8), web build green.
- Next: PR → merge; deploy BE FIRST, then web (the new web reads `dress.codes`; against the old BE it is undefined → card/detail throw on `.length`; the old web just ignores the new field). PR #30 (accessory, needs migrate) is still undeployed too.
- Watch out: a code like `VD_012` counts as a copy of `VD` — `baseOf` strips any trailing `_<digits>`; that is existing FR-CAT-08 behaviour, not new.

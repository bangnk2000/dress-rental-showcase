# Session Handoff

Newest first. On resume read ONLY the first entry. Close: prepend one entry (Done / Proof / Next /
Watch out, ≤ ~8 lines — detail belongs in the ledger evidence or the design doc), then keep at most
5 entries here: move the oldest, verbatim, to the top of
[`docs/harness/session-handoff-archive.md`](docs/harness/session-handoff-archive.md) (history only),
prefixing its relative link targets with `../../`.

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

## 2026-10-19 (48) — listing style `accessory` (Phụ kiện) (`catalog:listing-style-accessory` = pass)

- Done: seventh style code across DB CHECK (migration 1755700000000), `STYLES`, import keyword, FE vi/en labels, web chip + label, contract. PR #30; Codex C1 (no accessory e2e) fixed with migration up/down + `?style=accessory` tests. Ledger 49/49.
- Proof: be jest 289, web vitest 51, be e2e on real Postgres green.
- Next: merge, deploy (**migrate before BE restart**), then staff tag accessory listings in /website.
- Watch out: Codex MCP is pinned to 0.153.2 and the server now rejects every model for it; reviews ran via `codex exec -s read-only` (0.162.1).

## 2026-10-15 (47) — web-only deploys recorded (docs only)

- Done: PR #27 (`web:open-graph`) deployed 03:57 as `1472e07`; PR #28 (`web:static-images` +
  favicon) Codex-approved, CI flake fixed (`e2e/catalog-navigation.spec.ts` clock race), merged and
  deployed 04:59 as `5d797b1`. Ledger evidence + Current state now say so. Ledger 48/48.
- Proof: live example.com — og:* on every page, `/favicon.ico` 200, site images served as
  Cloudflare variants; execution log in `~/deploy-dress/tencent/RUNBOOK.md` §11.6.
- Next: owner runs Sharing Debugger "Scrape Again" on `/`; the r2 release debt (R1–R11, un-packed
  features) is unchanged and these two web deploys add to it.
- Watch out: a local standalone smoke needs `.next/static` + `public/` copied next to `server.js`
  (webbuild.sh does this) or the page never hydrates and every Playwright test fails.

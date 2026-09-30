# Readiness — infra/web-standalone: standalone deploy unit + bind rule

Makes the web deployable to the 2 GB VPS without a build or install there.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | [`public-web.md`](../../design/public-web.md) §1 Hosting, `apps/web/AGENTS.md` |
| All harness gates green | ok | `testedAt` 2026-09-30; web check/lint/arch 7/7/test 33, PR #22 CI green, Codex round 2 APPROVE; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | n-a | — |
| Acceptance criteria coverage | ok | below |
| Migration has a rollback plan | no-migration | — |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| W1 | the build emits a standalone server that runs with no install | ledger: 43 MB, ~102 MB rss; production: pm2 `dress-web` ~130 MB |
| W2 | behind a proxy with `X-Forwarded-Proto: https` every locale page answers 200 | ledger: header matrix; production: `verify-external.sh` public site all 200/404 as expected |
| W3 | web gates unchanged | ledger: check, lint, arch, test |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| `next build` copies a local `apps/web/.env` into the bundle | bangnk | _open_ — `webbuild.sh` deletes it; any other deploy path must too |

# Readiness — infra/web-bootstrap: the public Next.js app skeleton

Third application in the monorepo, and the first one that anonymous visitors reach. Its production run started in this release.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | spec set [`init-nextjs`](../../spec/init-nextjs/README.md) (monorepo mode) + [`public-web.md`](../../design/public-web.md) decisions table |
| All harness gates green | ok | `testedAt` 2026-09-24: full `init.sh` incl. web check/lint/arch 7/7/test/build; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | ok (type-level) | third generated client under `contract:check` in CI |
| Acceptance criteria coverage | n-a | the entry has no `acceptance`; none are invented after the fact (AGENTS.md §Session rules) |
| Migration has a rollback plan | no-migration | — |
| Observability for new behavior | missing | no web error or latency signal; see [§0](./release-plan.md) R1 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| Middleware + locale rewrite behind a proxy was never exercised until `infra/web-standalone` found the 127.0.0.1 bind bug | bangnk | _open_ — fixed by the bind rule; keep `HOSTNAME=localhost` (runbook §11.5) |

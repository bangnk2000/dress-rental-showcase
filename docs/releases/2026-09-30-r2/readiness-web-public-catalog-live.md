# Readiness — web:public-catalog-live: the web reads the live public catalogue

Swaps the web's mock for `GET /public/dresses[/:slug]` with ISR 300 s and the Cloudflare Images loader.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | [`web/public-pages.md`](../../design/web/public-pages.md) §5 as-built |
| All harness gates green | ok | `testedAt` 2026-09-30; web vitest 33, builds with and without a BE, runtime proof on `next start`; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | ok (type-level) | consumes the generated `catalog` client |
| Acceptance criteria coverage | n-a | the entry has no `acceptance`; none are invented after the fact (AGENTS.md §Session rules) |
| Migration has a rollback plan | no-migration | — |
| Observability for new behavior | **missing** | a failed ISR revalidation keeps the stale page silently. [§0](./release-plan.md) R1, R8 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| Production has 0 published listings: the live site shows an empty collection until staff publish | bangnk | _open_ — publish after reviewing the drafts (release-plan R11) |
| A rebuild with > ~50 published listings may fail on the public throttle | bangnk | _open_ — release-plan R7 |

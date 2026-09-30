# Readiness — web:public-pages: Home, Bộ sưu tập, dress detail, Liên hệ (FR-WEB-01..04)

The public pages, built from the prototype on mock data; the data source was swapped in `web:public-catalog-live`.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | partial | [`web/public-pages.md`](../../design/web/public-pages.md) written with the code at the owner's direct ask; its §3 lists 5 agent defaults not yet confirmed by the owner |
| All harness gates green | ok | `testedAt` 2026-09-25, web gates + build route table; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | n-a | web-only when built (mock); live contract use is covered by `web:public-catalog-live` |
| Acceptance criteria coverage | n-a | the entry has no `acceptance`; none are invented after the fact (AGENTS.md §Session rules) |
| Migration has a rollback plan | no-migration | — |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| The 5 unconfirmed agent defaults of public-pages.md §3 are now public | bangnk | _open_ — owner to confirm or change |
| Shop facts (address, hours, phone, maps link) are hard-coded in `apps/web/src/lib/shop.ts`; a change needs a web rebuild | bangnk | _open_ |

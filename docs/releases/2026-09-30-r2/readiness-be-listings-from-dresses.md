# Readiness — be:listings-from-dresses: CLI: bulk draft listings from dress code groups

A one-off data tool; it was RUN on production in this release.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | owner decisions recorded in the ledger evidence (CLI, drafts only, keyword styles, `silk` fallback) |
| All harness gates green | ok | `testedAt` 2026-09-30; be unit 288 (pure planner), dev run 95 created / re-run 0, PR #21 Codex round 2; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | n-a | no API change |
| Acceptance criteria coverage | n-a | the entry has no `acceptance`; none are invented after the fact (AGENTS.md §Session rules) |
| Migration has a rollback plan | no-migration | writes through `CreateListingService` + `SetListingDressesService` |
| Observability for new behavior | n-a | CLI prints created/skipped/failed |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| Production run: created=100, failed=0; re-run creates 0 ([record](./record.md)) | bangnk | _open_ — review names/styles; VAY87 is named "Chưa có mã", 10 fell back to `silk` |

# Readiness — infra/be-bootstrap: NestJS hexagonal backend + offline OpenAPI emit (FR-AUTH-01..03)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [identity-aggregate.md](../../design/identity-aggregate.md) and [catalog-aggregate.md](../../design/catalog-aggregate.md) exist and match the code, but were written **as-built** on 2026-08-04 (`f215d7b`), after the 2026-07-30 implementation — this is a retroactive approval, not a design gate. Both were re-synced to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) on 2026-08-09, so names (outcome codes, `staff_users.role`) are current |
| All harness gates green | ok | Ledger (2026-07-30): build / lint / arch (0 violations, 97 modules) / test (8). Re-verified 2026-08-10 on the release SHA: `pnpm --filter be build`, `lint`, `arch`, `test` = 95 unit, `test:e2e` = 30 on real Postgres. No `testedAt` field (predates it) |
| Contract evidence: provider + consumer tests | ok (type-level) | This entry created the provider side: `pnpm openapi:emit` writes `packages/contract/openapi.json` OFFLINE (no running server), tags identity+catalog, `operationId` pinned via `operationIdFactory`. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | ok — **destructive** | `apps/be/migrations/1753830000001_init.js` (staff_users, dresses) and `1753830000002_rentals_payments.js` (rentals, rental_items incl. the `rental_items_no_overlap` EXCLUDE constraint, payments). Both have `down`, and both `down`s are `DROP TABLE` — see [rollback.md](./rollback.md) §Data implications |
| Observability for new behavior | missing | [§0](./release-plan.md) R1. Structured pino logging exists (`libs/logging`) — logs are not observability, nothing reads them |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-AUTH-01/02: email+password login issues access + refresh tokens signed with two distinct secrets | `smoke.sh` vs the running app: login 200 with a token; `config.schema.ts` requires both secrets ≥16 chars or boot aborts |
| 2 | FR-AUTH-03: `GET /auth/me` returns the caller's profile; unauthenticated reads are refused | `smoke.sh`: no-token `GET /dresses` = 401, `me` = `role=owner` |
| 3 | Authorization is fail-closed ABAC, not role checks scattered in controllers | Policy registry + `PoliciesGuard`; an action with no registered policy is denied (proven again by `catalog/manage-dress`: no reactivate policy ⇒ no reactivate) |
| 4 | The booking overlap rule lives in the DATABASE | psql, bypassing the app: overlapping `blocking` INSERT rejected by `rental_items_no_overlap`; accepted once `blocking=false`. Re-proven continuously by `pnpm --filter be test:e2e` (`infra/invariant-proof-e2e`) |
| 5 | The contract can be emitted without a database or a server | `pnpm openapi:emit` offline, asserted by the CI `contract` job on every push |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| The seeded owner password is `changeme` everywhere in this repo (`smoke.sh`, the Playwright spec, the CI `e2e` job); production must not inherit it | bangnk | _open_ — this is prerequisite [P4](./release-plan.md); until it is done, anyone who reads the repo can sign in as owner |
| No password rotation, lockout or audit trail on `staff_users` — a leaked staff password is silent and permanent | bangnk | _open_ — the shop is ~2 staff on one tablet; the exposure is accepted or the release does not proceed |

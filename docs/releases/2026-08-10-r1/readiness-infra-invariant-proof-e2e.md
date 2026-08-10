# Readiness — infra/invariant-proof-e2e: the database invariants are proven against a real Postgres

This entry is why the release plan can claim the overlap rule holds in production: it tests the
constraint, not the code path that hopes to avoid it.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok | Required by [init-nestjs-hexagonal 09 — Invariant proof tests](../../spec/init-nestjs-hexagonal/09-testing-strategy.md); the suite's contract is `apps/be/AGENTS.md` §Invariant-proof suite. The invariants it names are the ones in the design docs' invariant-enforcement tables |
| All harness gates green | ok | `testedAt` 2026-08-09: 22 tests green via `pnpm --filter be test:e2e` against compose Postgres 16. Re-verified 2026-08-10 on the release SHA: **30 tests, 4 suites, green** (grown by the late-fee spec) |
| Contract evidence: provider + consumer tests | ok (type-level) | Adds no API surface; it asserts the exact outcome bodies the contract declares, over real HTTP — the strongest provider-side evidence in the repo ([§0](./release-plan.md) R4) |
| Acceptance criteria coverage | **ok** | 4 ACs, each with named evidence — see below |
| Migration has a rollback plan | no-migration | `global-setup` creates and migrates `<db>_test`; `e2e-database-url` REFUSES the dev database unless `E2E_ALLOW_DEV_DB=1`, so the suite cannot wipe working data by accident |
| Observability for new behavior | n/a | Test tooling, not production behavior |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| AC1 | A test provokes `rental_items_no_overlap` THROUGH the API (including the cleaning buffer) and asserts `rejected_dress_unavailable` | `apps/be/test/rentals-overlap.e2e-spec.ts`: overlapping range and a buffer-range booking both 422; the day after the buffer is 201 |
| AC2 | The same constraint is provoked by a concurrent race AND by a raw INSERT that bypasses the app | Two concurrent identical POSTs = exactly `[201, 422]` with ONE rentals row; a raw INSERT into a DIFFERENT rental (so UNIQUE cannot be the refuser) is rejected by the constraint |
| AC3 | Catalog UNIQUE(code), `rental_items` UNIQUE(rental_id, dress_id) and the status CHECKs each have a proof test | `catalog-unique-code.e2e-spec.ts` (API 422 + raw INSERT), `identity-unique-email.e2e-spec.ts` (role CHECK + email UNIQUE), DTO 400 + raw INSERT for the item pair; 404/401 verified to stay fault envelopes |
| AC4 | `pnpm --filter be test:e2e` exists and runs against a fresh compose/CI Postgres; CI has a postgres service | The script builds `dist` then runs jest with `test/jest-e2e.config.ts`; the CI `be` job declares a postgres service and runs it; `init.sh` calls the real gate (and WARNs, visibly, when no database is up) |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| **The `qr` context has no invariant proof**: `qr_links` immutability and its creator FK are asserted nowhere at the database level | bangnk | _open_ — the known coverage hole, carried since 2026-08-09. Lower stakes than rentals, but it is a gap in a suite whose value comes from being exhaustive |
| The suite drives the BUILT api out-of-process (slonik is ESM-only, jest is CJS) — a build-config change can silently change what is tested | bangnk | _open_ — documented in `apps/be/AGENTS.md`; the gate would fail loudly rather than pass hollow |
| It proves constraints, not migration ORDER on an existing database — nothing rehearses `migrate` against a copy of production | bangnk | _open_ — for r1 the production database is empty, so the risk begins at r2 |

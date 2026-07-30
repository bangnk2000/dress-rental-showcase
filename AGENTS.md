# AGENTS.md — dress-rental (root harness brief)

Internal management app for a dress-rental shop (~200 dresses), replacing Google Sheets.
Monorepo per `docs/spec/init-monorepo-contract/` — read that set first; the stack sets
(`docs/spec/init-nestjs-hexagonal/`, `docs/spec/init-react/`) are authoritative INSIDE
`apps/be` and `apps/fe` respectively. This file is the ONE harness in this repo — never
create another under `apps/*`.

## Current state (re-sync at every session end — see Session rules)

Both apps bootstrapped and gated (`infra/be-bootstrap`, `infra/fe-bootstrap` = pass).
`apps/be`: NestJS hexagonal — identity (JWT + ABAC) + catalog slices, migrations incl. the
rental_items EXCLUDE constraint, offline `openapi:emit`. `apps/fe`: React SPA — auth + dresses
slices on the generated client; rentals/today/dress-detail are shells awaiting their BE slices.
App-level contracts: `apps/be/AGENTS.md`, `apps/fe/AGENTS.md`. Next: README step 5 — feature
rhythm (`rentals/create-rental`) or finish `catalog/list-dresses` (CSV seed import).

## Invariants (carry these into every session)

1. **Contract is one-way:** `apps/be` source → `pnpm openapi:emit` → `packages/contract/openapi.json`
   → `pnpm generate:api` → `apps/fe/src/api/generated/`. Neither generated artifact is EVER
   hand-edited. "FE needs a field" = BE change first, then `pnpm contract`.
2. BE: dependencies point inward; SDKs only in adapters (init-nestjs-hexagonal rules).
3. FE: no cross-feature imports; server state only in the TanStack Query cache (init-react rules).
4. Cross-app sharing only through `packages/*` — apps never import each other.
5. FE and BE ship as one unit (same origin in prod; `docs/spec/init-monorepo-contract/03 §3`).
6. Rental domain rule: booking overlap per dress is rejected at the DB level
   (Postgres `daterange` + exclusion constraint), never only in application code.

## Gates (in order — also encoded in `init.sh` and CI)

```
pnpm contract:check   # emit + generate + git diff --exit-code (drift gates 1+2)
pnpm check            # be build + fe tsc (drift gate 3)
pnpm lint && pnpm arch
pnpm test
pnpm --filter be test:e2e   # compose stack
pnpm --filter fe build
```

## Session rules

- ONE `feature_list.json` entry in progress at a time; evidence before "pass". A
  cross-contract feature is ONE entry carrying BOTH sides' proof
  (`docs/spec/init-monorepo-contract/04-harness-binding.md`).
- Feature ids: `<context>/<use-case>` (BE convention); FE slice `features/<kebab-id>` belongs
  to the same entry. Single-side work: prefix `be:` / `fe:`.
- Scaffold order for an API-touching feature: BE slice → `pnpm contract` → FE slice. The
  contract step is part of the scaffold, not optional glue.
- End of session: update `feature_list.json` + `session-handoff.md`; **re-sync the Current
  state section of this file to the repo as-committed** (a stale current-state misroutes the
  next session — init-harness 03 §3.5); run `clean-state-checklist.md`; no unintended diff
  under `packages/contract` or `apps/fe/src/api/generated`.

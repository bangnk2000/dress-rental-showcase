# AGENTS.md — dress-rental (root harness brief)

Internal management app for a dress-rental shop (~200 dresses), replacing Google Sheets.
Monorepo per `docs/spec/init-monorepo-contract/` — read that set first; the stack sets
(`docs/spec/init-nestjs-hexagonal/`, `docs/spec/init-react/`) are authoritative INSIDE
`apps/be` and `apps/fe` respectively. This file is the ONE harness in this repo — never
create another under `apps/*`.

## Current state

Skeleton only. `apps/be` and `apps/fe` are NOT bootstrapped yet — `README.md` carries the
exact next kickoff prompts (steps 2 and 4). `packages/contract/openapi.json` appears with the
first `pnpm openapi:emit`.

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
- End of session: update `feature_list.json` + `session-handoff.md`; run
  `clean-state-checklist.md`; no unintended diff under `packages/contract` or
  `apps/fe/src/api/generated`.

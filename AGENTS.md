# AGENTS.md — dress-rental (root harness brief)

Internal management app for a dress-rental shop (~200 dresses), replacing Google Sheets.
Monorepo per the init-monorepo-contract spec set. Spec entry points — read the README index
first, NEVER bulk-read a spec folder; each README's File Map says which numbered detail file
to open when the task actually needs it:

- `docs/spec/init-monorepo-contract/README.md` — monorepo/contract rules (this repo's shape)
- `docs/spec/init-nestjs-hexagonal/README.md` — authoritative INSIDE `apps/be`
- `docs/spec/init-react/README.md` — authoritative INSIDE `apps/fe`
- `docs/spec/init-harness/README.md` — session lifecycle rules behind this file

This file is the ONE harness in this repo — never create another under `apps/*`.

## Current state (re-sync at every session end — see Session rules)

MVP scope complete and the follow-up backlog is tracked; NO shell routes remain. `apps/be`:
NestJS hexagonal — identity (JWT + ABAC), catalog (create/update/owner-only-retire + photo
LINKS in `photo_urls text[]`, list/get dress; status stays active/retired — renting/cleaning
derived from rentals; one-time seed via `pnpm --filter be import:dresses <csv>`), rentals
(create-rental with the rental_items EXCLUDE overlap constraint incl. cleaning buffer;
pickup booked→out and return booked|out→returned, the return settling deposit/late/damage
fees into the payments table via `PaymentRecorderPort` — payments context itself is still
schema-only; availability + booked-ranges + today-board + list-rentals reads — the board
carries due-out/due-back/OVERDUE, the list searches customer name/phone with status filter
and pagination; range columns always SELECTed as `::text` literals), offline `openapi:emit`.
`apps/fe`: React SPA — auth + dresses slices (live `/dresses/:id` detail), the new-rental
form, the ACTIONABLE today board at `/` (device-local date; pickup button on due-out,
return-and-settle dialog on due-back + overdue), and the real `/rentals` list (URL-owned
q/status/page filters). App-level contracts: `apps/be/AGENTS.md`, `apps/fe/AGENTS.md`.
Next (tracked todos): `rentals/cancel-rental`, `payments/list-payments`,
`infra/e2e-playwright` — see session-handoff (10) for the suggested order.

## Invariants (carry these into every session)

1. **Contract is one-way:** `apps/be` source → `pnpm openapi:emit` → `packages/contract/openapi.json`
   → `pnpm generate:api` → `apps/fe/src/api/generated/`. Neither generated artifact is EVER
   hand-edited. "FE needs a field" = BE change first, then `pnpm contract`.
2. BE: dependencies point inward; SDKs only in adapters (init-nestjs-hexagonal rules).
3. FE: no cross-feature imports; server state only in the TanStack Query cache (init-react rules).
4. Cross-app sharing only through `packages/*` — apps never import each other.
5. FE and BE ship as one unit (same origin in prod;
   `docs/spec/init-monorepo-contract/03-ci-and-runtime.md` §3).
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
  next session — `docs/spec/init-harness/03-session-loop.md` §3.5); run
  `clean-state-checklist.md`; no unintended diff
  under `packages/contract` or `apps/fe/src/api/generated`.

# Progress Log

- 2026-07-30 (3) — FE bootstrap complete (`infra/fe-bootstrap` pass). React 19 SPA in
  `apps/fe`: Orval client from the real contract, auth (bearer+refresh) + dresses slices,
  rentals/today shells, PWA + vi/en i18n; guardrails: check-architecture.sh (`pnpm arch`),
  plop feature generator, boundaries v7 migration, `apps/fe/AGENTS.md`. All root gates green;
  runtime proof via Vite proxy against compose stack (login 200, list 200, 401, 201/409).
  Next: step 5 — feature rhythm (`rentals/create-rental`) or CSV import for catalog/list-dresses.
- 2026-07-30 (2) — BE bootstrap complete (`infra/be-bootstrap` pass). NestJS 11 hexagonal in
  `apps/be`: libs kernel (ddd/db/authz/exceptions/config/logging), identity (JWT + ABAC),
  catalog proving slice, migrations incl. rental_items EXCLUDE constraint, offline
  `openapi:emit` → `packages/contract/openapi.json`, plop scaffolds, dep-cruiser + eslint
  gates, smoke.sh runtime proof. Next: FE bootstrap (README step 4).
- 2026-07-30 — Repo created from `init-monorepo-contract` spec (knowledge-system). Skeleton:
  pnpm workspace, `packages/contract/`, CI drift gates, root harness artifacts, four prompt
  sets copied to `docs/spec/`. Apps pending bootstrap (see `README.md` steps 2 and 4).

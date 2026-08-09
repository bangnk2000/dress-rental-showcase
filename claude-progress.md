# Progress Log

Append-only, newest first (`docs/spec/init-harness/02-artifacts-and-templates.md` §2.4). Detail per
session — evidence, decisions, watch-outs — lives in `session-handoff.md`; this file is the index.

- 2026-08-10 (20) — `rentals/settle-late-fee` (FR-RENT-09) = pass — the first capability driven
  through the `init-feature-spec` lane: spec `draft` with the business rules left as blocker
  questions, contract check on the draft, owner decisions recorded in §6, THEN code, then an as-built
  re-sync (§7). Late fee = days late × dresses × 200.000₫ (buffer excluded), computed by a pure
  domain value object that both the read and the write path call; waiver is owner-only and needs a
  reason, surfacing the repo's first 403 outcome. be 95 unit + 30 e2e, fe 57, qr-admin 13, all root
  gates + Playwright green. Side fix: `lib/format.ts` no longer reads the i18n singleton (money
  formatted en-style under test while the UI was vi).
- 2026-08-09 (19) — Process-conformance refactor, docs AND code. Design gate first: ADR 0001
  (outcome model + full outcome catalog + UI state matrix) approved, SRS/design docs re-synced to it,
  `docs/design/README.md` gained the B2.1 outcome-catalog lane and an ADR index. Then the two MUST
  gaps were closed as tracked features: `infra/outcome-model` (BE `BusinessOutcomeException` +
  `{ error: … }` envelope + 9 controllers rendering named 422 outcomes with typed payloads → contract
  → one `mapApiError` seam in both clients, three `is-conflict-error.ts` files deleted) and
  `infra/invariant-proof-e2e` (22 tests on real Postgres provoking the EXCLUDE/UNIQUE/CHECK
  constraints, `pnpm --filter be test:e2e`, CI postgres service, real gate in `init.sh`).
  `apps/qr-admin` finally has its own app-level contract, and the `AGENTS.md` files were cut back to
  routing + pointers so detail is read on demand. Committed on
  `feat/outcome-model-and-invariant-proof`; every gate green including `bash init.sh` and the
  Playwright happy path on the real stack (which needed two fixes to be runnable as documented:
  `seed-owner.cjs` now loads `.env`, and the board locators are scoped to the run's own rows).
  Next: a first `docs/releases/` record via `docs/spec/init-release/`.
- 2026-08-09 (18) — Doc/spec maintenance session, no product code. `docs/spec/` re-synced from
  `knowledge-system` `815fa0f`: four sets refreshed, `init-feature-spec` + `init-release` added,
  new `docs/spec/README.md` records provenance + the one local delta + the re-sync recipe. The new
  upstream standard (business outcomes survive the boundary: `BusinessOutcomeException` outcome
  bodies, `{ error: { … } }` envelope, FE `mapApiError`, `Idempotency-Key`) is NOT implemented here,
  so it is recorded as `apps/be/AGENTS.md` #6 and `apps/fe/AGENTS.md` #8 — one cross-contract change,
  to be done in one go. Harness artifacts caught up with the repo: root `AGENTS.md` (spec entry
  points, design gate, `acceptance` field, honest gate list), `clean-state-checklist.md`,
  `init.sh` + CI comments (dead "README step 2/4" pointers replaced), README doc index, and this
  log's 2026-07-30 → 2026-08-06 backfill. Next: spec gap #5 (real-Postgres invariant proof).
- 2026-08-06 (17) — `qr/styled-svg-rendering` pass: rendered SVGs get the shop's red-pink frame,
  hearts and thank-you caption, all outside the QR quiet zone; error correction `H`.
- 2026-08-04 (14–16) — QR URL phase, three sessions: design gate first (`docs/SRS-qr-url.md`,
  `docs/design/qr-aggregate.md`, `docs/design/qr-admin.md`), then `infra/qr-admin-bootstrap` (the
  independent `apps/qr-admin` Vite/React workspace with its own generated client + gates; root
  contract/CI extended to both clients), then `qr/create-url-code` (owner-only immutable `qr_links`,
  strict direct-http(s) `TargetUrl`, offline SVG rendering, bearer Blob preview/download).
- 2026-08-04 — Intent docs backfilled as-built (dated 2026-07-31/08-02 in-session): `docs/spec`
  design-first re-sync (`b219f3a`), then `docs/SRS-dress-rental.md` + four per-context tactical
  designs with invariant-enforcement tables (`f215d7b`).
- 2026-07-30 (4–13) — MVP feature rhythm, all `pass`, one entry per session:
  `rentals/create-rental` (first cross-contract feature, DB EXCLUDE overlap constraint) →
  `rentals/availability-check` (dress detail live) → `catalog/manage-dress` →
  `catalog/list-dresses` (+ CSV seed import) → `rentals/today-board` → `rentals/return-rental`
  (pickup/return + settlement) → `rentals/list-rentals` (no shell routes left) →
  `rentals/cancel-rental` → `payments/list-payments` → `infra/e2e-playwright`
  (vi-locale happy path vs the real stack; tracked backlog empty).
- 2026-07-30 (3) — FE bootstrap complete (`infra/fe-bootstrap` pass). React 19 SPA in
  `apps/fe`: Orval client from the real contract, auth (bearer+refresh) + dresses slices,
  rentals/today shells, PWA + vi/en i18n; guardrails: check-architecture.sh (`pnpm arch`),
  plop feature generator, boundaries v7 migration, `apps/fe/AGENTS.md`. All root gates green;
  runtime proof via Vite proxy against compose stack (login 200, list 200, 401, 201/409).
- 2026-07-30 (2) — BE bootstrap complete (`infra/be-bootstrap` pass). NestJS 11 hexagonal in
  `apps/be`: libs kernel (ddd/db/authz/exceptions/config/logging), identity (JWT + ABAC),
  catalog proving slice, migrations incl. rental_items EXCLUDE constraint, offline
  `openapi:emit` → `packages/contract/openapi.json`, plop scaffolds, dep-cruiser + eslint
  gates, smoke.sh runtime proof. Next: FE bootstrap.
- 2026-07-30 — Repo created from `init-monorepo-contract` spec (knowledge-system). Skeleton:
  pnpm workspace, `packages/contract/`, CI drift gates, root harness artifacts, four prompt
  sets copied to `docs/spec/`. Apps pending bootstrap.

# Progress Log

Append-only, newest first (`docs/spec/init-harness/02-artifacts-and-templates.md` §2.4). Detail per
session — evidence, decisions, watch-outs — lives in `session-handoff.md`; this file is the index.

- 2026-08-10 (24) — the repo's whole unpushed history (18 commits) went out as **five stacked PRs**
  (#1 QR phase → #2 outcome model + invariant proof → #3 e2e CI + release record → #4 UI review
  batch → #5 FR-PAY-02), each reviewed by the codex CLI in WSL and fixed until the review returned
  nothing: 20 findings, most of them in the money paths — a TOCTOU on recording money, two screens
  reading a failed/loading ledger as "nothing collected", a settlement basis that could be raced
  past until the check moved under the rental's row lock, a catalog duplicate answering 409 or 422
  depending on who won, and a QR admin that never used its refresh token. ADR 0001 gained the
  general rule: a pre-check and the DB constraint behind it are two guards of ONE rule, and the
  client must not be able to tell which fired. init.sh green at the tip (be 114 + 46 e2e, fe 83,
  qr-admin 17) plus Playwright. Nothing merged — the stack merges in order, #1 first.
- 2026-08-10 (23) — `payments/record-collection` = pass (FR-PAY-02), ledger 25/25. The deposit the
  shop TAKES is finally written down, and the refund at return is computed from it instead of from
  the catalog. Spec-before-code again: the rules went to the owner as blocker questions and came back
  as four decisions (standalone action usable any time · pre-filled but editable amounts, ledger
  records what was taken · fees ARE deducted from the deposit — closing the assumption session 22
  recorded · rental fee in scope too). The `payments` context grew its first aggregate + command, and
  BR-7 ("one deposit and one rental fee per rental") is enforced by two partial UNIQUE indexes, with
  the concurrent race, the repeat call and a raw INSERT all provoked on real Postgres. Read side
  gained `summary`; `RentalDressDto` gained `agreedPrice`. be 109 unit + 42 e2e, fe 71, qr-admin 13,
  all root gates and Playwright green — the browser run is what caught the return dialog serving a
  stale ledger, now a recorded invalidation rule.
- 2026-08-10 (22) — UI/UX review of `apps/fe` (22 findings across the whole SPA), then its top four
  groups shipped as four features, ledger now 24/24 `pass`. `rentals/settlement-clarity`
  (cross-contract: `RentalDressDto.depositAmount` → the return dialog pre-fills the refund with
  `deposit − suggested late fee`, states the arithmetic live and reads every amount back grouped —
  the only screen that moves cash was asking for a seven-digit number from memory; the deduction
  convention is a RECORDED ASSUMPTION, not an owner decision). `rentals/dress-availability-in-picker`
  (each chosen dress checks itself against the form's dates; a rejection marks the exact dresses
  `dressIds` names, which ADR 0001 designed for and the form was discarding).
  `catalog/dress-thumbnails` (photos where dresses are CHOSEN, not only on the detail page).
  `fe:board-and-confirm-ergonomics` (day stepping in a transition so the board stops blanking, ±day
  + `Hôm nay`, 44px actions, per-row spinner from `mutation.variables`, customer in the accessible
  name, and `window.confirm` replaced by an in-app AlertDialog whose dismiss says `Quay lại`).
  fe 66 tests, be 95 + 30 e2e, qr-admin 13, all root gates and the Playwright happy path green.
  `docs/releases/2026-08-10-r1/` now names these four as explicitly NOT covered by its readiness pass.
- 2026-08-10 (21) — `infra/e2e-ci` = pass, and the repo's FIRST release record. The browser proof
  stopped being manual: `playwright.config.ts` starts the BE and the FE **production build**
  (`vite preview` :4173, `preview.proxy` added to `vite.config.ts`) itself, so `pnpm --filter fe e2e`
  is one command locally and in CI; `E2E_BASE_URL` opts out of that entirely. New CI `e2e` job with
  its own postgres, migrate + seed, chromium, and report/trace uploaded on failure. Proven cold
  (18.2s) and with `CI=1` (17.1s); the opt-out branch proven by 0 `[WebServer]` lines against a dead
  port. Then the `init-release` lane ran for real → `docs/releases/2026-08-10-r1/`: 20 readiness
  files, release plan (risks R1–R4, prerequisites P1–P7, ordered steps, compatibility matrix),
  rollback plan, seeded record, index. It found what a uniform `pass` ledger hides — no deployment
  artifact exists at all, NFR-03 same-origin is load-bearing because CORS is never enabled, every
  migration `down` is a `DROP` so reversal is safe exactly once, there is no observability or flag
  anywhere, and the `qr` slices have no live-DB/browser/print proof. Ends at "STOP — awaiting
  go/no-go"; nothing was deployed and nothing is committed.
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

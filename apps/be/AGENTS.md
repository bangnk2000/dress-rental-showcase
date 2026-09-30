# AGENTS.md — apps/be (architecture contract)

NestJS 11 hexagonal backend per the init-nestjs-hexagonal set — entry point
`docs/spec/init-nestjs-hexagonal/README.md` (open its numbered detail files only per the File
Map, never the whole folder) + the monorepo deltas in
`docs/spec/init-monorepo-contract/01-workspace-structure.md` §4. **Session harness lives at
the repo ROOT** (`../../AGENTS.md`, `feature_list.json`, `init.sh`) — never create harness
files here.

## Commands (run from repo root)

| Command | What |
| --- | --- |
| `pnpm --filter be build` / `lint` / `arch` / `test` | gates (tsc, eslint over `src` + `test`, dependency-cruiser, jest unit) |
| `pnpm --filter be test:e2e` | invariant-proof suite: builds the api, creates/migrates `<db>_test`, provokes the real EXCLUDE/UNIQUE/CHECK constraints (needs Postgres running) |
| `pnpm openapi:emit` | build + dump swagger → `packages/contract/openapi.json` (OFFLINE — no DB) |
| `pnpm --filter be migrate` / `seed` | node-pg-migrate up / seed owner (needs `DATABASE_URL`, `SEED_OWNER_PASSWORD`) |
| `pnpm --filter be import:dresses <file.csv>` | one-time catalog seed from the shop's Sheets CSV (header per `seed/dresses.sample.csv`; duplicates skipped — safe to re-run; exit 1 if rows failed) |
| `pnpm --filter be listings:from-dresses [--prefix VAY] [--dry-run]` | bulk-create DRAFT website listings, one per code group (`<code>` + `<code>_n` = sizes); styles from name keywords (none → `silk`); groups with a dress already in a listing skipped — safe to re-run; never publishes (planner: `modules/catalog/import/listings-from-dresses.ts`) |
| `pnpm --filter be plop slice\|query -- --context <c> --name <kebab>` | deterministic slice scaffold |
| `bash scripts/smoke.sh` | runtime proof against a running app + FRESH DB (dresses 201/409 → rentals 201, buffer-overlap 409, 404, 400) |
| `docker compose up -d` (root) | Postgres 16 for dev/tests |

## Layer rules (dependency-cruiser enforces; `pnpm --filter be arch`)

- Four layers, dependencies inward: controller → command/query service → domain; `database/`
  implements `application/ports/*`. Domain imports NOTHING from @nestjs/slonik/pg/jwt/pino.
- No cross-module imports — contexts talk via CommandBus/QueryBus/EventEmitter events only.
- Business errors are RETURNED (`Result<T, DomainError>`, oxide.ts); technical failures are
  THROWN (`libs/exceptions`) and mapped by the global filter. Controllers `match()` and convert.
- **returned vs thrown IS the wire contract** ([ADR 0001](../../docs/adr/0001-outcome-model-at-the-http-boundary.md)):
  a returned Err becomes `throw new BusinessOutcomeException({ status: '<code>', ...payload })`
  (422, or 403 for a named denial) — code taken from the ADR §3 catalog, never invented at the
  keyboard; a thrown exception becomes the envelope `{ error: { code, message, details?,
  correlationId } }`. No third shape, no `GENERIC.*` for a rejection. The outcome payload lives as
  a TYPED field on the domain error (`error.dressIds`, `error.currentStatus`), and each operation
  declares `@ApiResponse({ status: 422, type: <UseCase>OutcomeDto })` so both clients get literal
  types.
- One command = one aggregate = one transaction; domain events publish INSIDE the transaction
  (`SqlRepositoryBase.writeInTransaction`).
- Reads may bypass domain and hit the pool directly (query handlers import slonik — allowed).

## Contract rules (the monorepo's reason to exist)

- Every controller: `@ApiTags('<context>')`; every op: explicit `@ApiOkResponse`/`@ApiCreatedResponse({ type })`
  + error `@ApiResponse`s. Missing type = silent `unknown` in the FE client.
- operationId = `Controller_method` (pinned in `src/app.setup.ts`). Renaming a controller/method
  renames FE hooks — deliberate breaking change only.
- Swagger config is SHARED between `/docs` and the emit script via `src/app.setup.ts` — never
  configure swagger anywhere else.
- Route ORDER is contract too: Express matches in registration order, so a `GET <ctx>/:id`
  controller must be listed AFTER its literal siblings in the module (`rentals/today-board`
  before `rentals/:id` — `GetRentalHttpController` is last for that reason, and ParseUUIDPipe
  would 400 the board otherwise).
- `openapi:emit` must stay OFFLINE: `OPENAPI_EMIT=1` swaps the DB pool for a throwing stub
  (`libs/db/database.module.ts`). If emit ever needs infra, fix the eager provider — don't
  weaken the stub.

## AuthN/AuthZ (ABAC)

- `JwtAuthGuard` (global) → sets `request.user = { staffId, role }`; `@Public()` opts out
  (login/refresh only).
- `PoliciesGuard` (global, after auth) evaluates `@RequirePermission('<resource>:<action>')`
  against `libs/authz/policy-registry` — **fail-closed**: unregistered permission = deny.
- Each context registers policies in `<context>.policies.ts` (imported by its module). Reads
  need authentication only; writes declare permissions.

## Deviations from the stack spec (deliberate, keep consistent)

1. **Relative imports, no `@libs/@modules` aliases** — `openapi:emit` runs from compiled `dist/`
   and tsc does not rewrite path aliases; a runtime resolver adds fragility for zero gain here.
2. **Concrete list DTOs** (`DressListResponseDto`) instead of a generic `Paginated<T>` swagger
   envelope — keeps Orval output clean without `ApiExtraModels` ceremony.
3. **Command handler files named `*.service.ts`** (per spec §02 naming) — no `*.command-handler.ts`.
4. **Cross-context table-read adapters** (`rentals/database/dress-lookup.adapter.ts`,
   `rentals/database/payment-recorder.adapter.ts`, `payments/database/rental-lookup.adapter.ts`)
   — the 2026-07-31 spec re-sync forbids reading a sibling context's tables (spec 01 §4 MUST NOT,
   14-design-first §3.2; sanctioned channel = contract query on the QueryBus via
   `libs/contracts/`). Kept as a deliberate deviation for this 4-context app: the adapters are
   few, commented as boundaries, and a QueryBus layer earns nothing at this size. The cost is
   schema-level coupling no guardrail sees — if a shared table's columns change, grep these
   adapters. Migration path when it bites: one contract query per adapter.
5. **`correlationId` comes from the `x-request-id` header**, read in the global filter — the
   AsyncLocalStorage request-context of spec 07 §Observability is not implemented. The envelope
   shape is unaffected; add the context only when a log needs to be correlated without a header.

(Historical: gaps #5 "no invariant proof" and #6 "flat `GENERIC.*` rejections" were CLOSED on
2026-08-09 by `infra/invariant-proof-e2e` and `infra/outcome-model`; the story is in
`docs/adr/0001-outcome-model-at-the-http-boundary.md` §1 and `session-handoff.md` (19). Only LIVE
deviations are numbered here, so nothing below is a constraint that no longer exists.)

## Wire contract — three facts, then read [ADR 0001](../../docs/adr/0001-outcome-model-at-the-http-boundary.md)

- Outcome codes come from the ADR §3 catalog, never from the keyboard. Adding one = update §3 + §4
  first (and the FE key), then code.
- The overlap race is converted where the rule lives: the repository turns the constraint violation
  into `RentalItemsOverlapError` (`application/ports/rental-overlap.error.ts`) and
  `create-rental.service.ts` returns `DressUnavailableError` with re-queried ids — so race and
  pre-check yield the SAME `rejected_dress_unavailable` body.
- Do NOT reintroduce 401 for a wrong password. 401 means "a guard rejected the access token"; the
  FE's refresh-and-retry interceptor depends on that being the only meaning.

## Invariant-proof suite (`test/`, `pnpm --filter be test:e2e`)

- Drives the **built** api (`dist/main.js`) out-of-process: slonik is ESM-only and jest's CommonJS
  registry cannot load it. Raw SQL therefore uses `pg` (`test/e2e-db.ts` + `test/types/pg.d.ts`).
- It TRUNCATES tables, so `test/e2e-database-url.ts` forces a separate `<db>_test` database and
  refuses the dev URL unless `E2E_ALLOW_DEV_DB=1`; `test/global-setup.ts` creates + migrates it.
- A new invariant row in a design doc means a new spec here in the same change — that column is
  the promise, this folder is the proof.

## Where do I add a new use case?

0. Trace it to an FR-id in `docs/SRS-dress-rental.md` and tier it per `docs/design/README.md`
   §Quy trình: design-tier (new aggregate/invariant/state transition/cross-context contract) →
   update `docs/design/<ctx>-aggregate.md` (incl. the invariant-enforcement table) and get it
   approved BEFORE scaffolding; standard CRUD → the filled scaffold input contract is enough.
   Has business rejections? List them as an outcome catalog first
   (`docs/spec/init-feature-spec/`) — that catalog is the scaffold prompt's `outcomes` input and
   the FE's branch list, so it is written once, before either side is scaffolded.
1. `pnpm --filter be plop slice -- --context <ctx> --name <verb-noun>` (or `query`).
2. Domain first (entity method/VO/error in `modules/<ctx>/domain/`), then fill the service,
   then the controller's error→HTTP mapping + swagger decorators, then the spec file.
3. Register handler/controller in `<ctx>.module.ts`; new write permission → `<ctx>.policies.ts`.
4. New table/column → new migration in `migrations/` (never edit a shipped one).
5. `pnpm --filter be build lint arch test` → `pnpm contract` (root) → commit BE + contract +
   FE client together.

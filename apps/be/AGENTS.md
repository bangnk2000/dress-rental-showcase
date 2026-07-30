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
| `pnpm --filter be build` / `lint` / `arch` / `test` | gates (tsc, eslint, dependency-cruiser, jest) |
| `pnpm openapi:emit` | build + dump swagger → `packages/contract/openapi.json` (OFFLINE — no DB) |
| `pnpm --filter be migrate` / `seed` | node-pg-migrate up / seed owner (needs `DATABASE_URL`, `SEED_OWNER_PASSWORD`) |
| `pnpm --filter be plop slice\|query -- --context <c> --name <kebab>` | deterministic slice scaffold |
| `bash scripts/smoke.sh` | runtime proof against a running app + FRESH DB (dresses 201/409 → rentals 201, buffer-overlap 409, 404, 400) |
| `docker compose up -d` (root) | Postgres 16 for dev/tests |

## Layer rules (dependency-cruiser enforces; `pnpm --filter be arch`)

- Four layers, dependencies inward: controller → command/query service → domain; `database/`
  implements `application/ports/*`. Domain imports NOTHING from @nestjs/slonik/pg/jwt/pino.
- No cross-module imports — contexts talk via CommandBus/QueryBus/EventEmitter events only.
- Business errors are RETURNED (`Result<T, DomainError>`, oxide.ts); technical failures are
  THROWN (`libs/exceptions`) and mapped by the global filter. Controllers `match()` and convert.
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

## Where do I add a new use case?

1. `pnpm --filter be plop slice -- --context <ctx> --name <verb-noun>` (or `query`).
2. Domain first (entity method/VO/error in `modules/<ctx>/domain/`), then fill the service,
   then the controller's error→HTTP mapping + swagger decorators, then the spec file.
3. Register handler/controller in `<ctx>.module.ts`; new write permission → `<ctx>.policies.ts`.
4. New table/column → new migration in `migrations/` (never edit a shipped one).
5. `pnpm --filter be build lint arch test` → `pnpm contract` (root) → commit BE + contract +
   FE client together.

# Implementation Checklist — Zero to First AI-Agent-First Slice

An ordered, practical checklist to bootstrap the repo from an empty directory to a
first working vertical slice that an AI coding agent can extend safely. Phases are
sequential; items inside a phase mostly are too. Tick `[ ]` as you go.

**Output-Scaling note:** the fullest format here is a CEILING. For a small project,
collapse phases 9 and parts of 8 (acceptance/e2e) until the domain earns them — see
the YAGNI guidance in `01-architecture-principles.md`. For an enterprise / multi-context
build, do every phase. Do not over-engineer a two-entity domain.

Priority key (matches sibling files): **Required** · **Optional** · **Prod-only** · **Experimental**.

---

## Phase 0 — Prereqs & decisions (Required)

Lock these before writing code; they shape every later phase.

- [ ] Pin **Node.js 22 LTS** (`.nvmrc` / `engines.node` in `package.json`). NestJS 11 requires Node **≥ 20** (v16/v18 are dropped); 22 LTS is the recommended target.
- [ ] Target **NestJS 11** (Express 5 is the default HTTP adapter) + **TypeScript 5.7+**. NestJS 12 (ESM, Standard Schema, Vitest, oxlint) is roadmapped for Q3 2026 and migrates additively — see `07-cross-cutting.md`.
- [ ] Choose **package manager** — `pnpm` (preferred, workspace-friendly for `libs/`). Commit the lockfile.
- [ ] Decide **persistence option** per `05-infrastructure-layer.md`:
  - [ ] **Slonik** (raw SQL) for complex domains — preferred when queries are non-trivial.
  - [ ] **TypeORM / Prisma** for simpler domains — acceptable, less control.
  - Record the choice in `AGENTS.md`; it must be uniform across modules.
- [ ] Choose **Result library**: `oxide.ts` (`Ok`/`Err`/`Result<T,E>`) or `@badrap/result`. Pick ONE repo-wide.
- [ ] Choose **transport(s)** for the first slice: HTTP (`*.http.controller.ts`) is the default; add CLI / message / GraphQL only if needed (`06-interface-layer.md`).
- [ ] Confirm **bounded contexts** to start with — one real domain context + the `ai-agent` context (`08-ai-agent-first.md`).
- [ ] Decide **config validation** lib: `zod` (default here) or `joi`, behind `@nestjs/config`.
- [ ] Set the **default LLM model**: `claude-sonnet-4-6` (see `08-ai-agent-first.md`). Never hardcode legacy `claude-3-*` ids.

## Phase 1 — Init Nest app + tsconfig + lint/format (Required)

- [ ] `npx @nestjs/cli@^11 new <app>` (NestJS 11; Express 5 by default). Remove generated boilerplate you won't keep.
- [ ] Configure `tsconfig.json`: `target: ES2023` (Node 20+), `module: commonjs` (NestJS 11 default; ESM lands in v12), `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, path aliases (`@libs/*`, `@modules/*`).
- [ ] Enable decorator support: `experimentalDecorators` + `emitDecoratorMetadata` (required for `@nestjs/cqrs` and DI).
- [ ] Add **ESLint** + **Prettier**; wire the typescript-eslint parser to the project `tsconfig`.
- [ ] Add the **eslint boundaries** rules so layering is lint-enforced (`01-architecture-principles.md`, `07-cross-cutting.md`).
- [ ] Add npm scripts: `build`, `start:dev`, `lint`, `format`, `test`, `test:e2e` (you'll extend these in later phases).
- [ ] (Optional) Enable **SWC** for fast builds/tests: `nest build`/`nest start --builder swc`, and `@swc/jest` for unit tests (`09-testing-strategy.md`).
- [ ] Commit `.gitignore`, `.editorconfig`, `.env.example` (keys only, no secrets).

## Phase 2 — Install dependencies (Required)

Install in grouped batches so the agent can reason about each concern.

- [ ] Core CQRS + framework (NestJS 11 line; core/common/platform-express come from `nest new`):
  ```bash
  pnpm add @nestjs/cqrs@^11 @nestjs/event-emitter@^3 @nestjs/config@^4 @nestjs/swagger@^11
  ```
- [ ] Validation + transformation (DTOs):
  ```bash
  pnpm add class-validator class-transformer        # class-validator ^0.14, class-transformer ^0.5
  ```
- [ ] Result type + config schema:
  ```bash
  pnpm add oxide.ts zod        # zod ^3 (or ^4); or @badrap/result instead of oxide.ts
  ```
- [ ] Persistence driver (pick per Phase 0):
  ```bash
  pnpm add slonik              # OR: pnpm add typeorm pg   /   pnpm add @prisma/client
  ```
- [ ] AI / LLM SDK (adapter only, behind a port):
  ```bash
  pnpm add @anthropic-ai/sdk
  ```
- [ ] Logging:
  ```bash
  pnpm add pino nestjs-pino
  ```
- [ ] HTTP hardening + ops (interface / Prod):
  ```bash
  pnpm add helmet @nestjs/throttler @nestjs/terminus
  ```
- [ ] Architecture guardrails + scaffolding (dev):
  ```bash
  pnpm add -D dependency-cruiser plop
  ```
- [ ] Testing (dev):
  ```bash
  pnpm add -D jest ts-jest @types/jest @nestjs/testing@^11 supertest @types/supertest \
    @cucumber/cucumber @testcontainers/postgresql
  # faster compile: pnpm add -D @swc/core @swc/jest   (NestJS 12 will default to Vitest)
  ```
- [ ] Verify no dependency drags an SDK/IO lib into a place the domain could import it (checked again in Phase 4).

## Phase 3 — Build `libs/` shared kernel (Required)

The shared DDD kernel; framework-free where the spec demands (`03-domain-layer.md`).

- [ ] `libs/ddd/entity.base.ts` — `Entity`: `readonly id/createdAt/updatedAt`, equality by id, `validate()`, no public setters.
- [ ] `libs/ddd/aggregate-root.base.ts` — `AggregateRoot extends Entity`: `addEvent()` / `publishEvents()`; consistency boundary.
- [ ] `libs/ddd/value-object.base.ts` — immutable, structural equality, guard-based validation in constructor.
- [ ] `libs/ddd/domain-event.base.ts`, `command.base.ts`, `query.base.ts` — base contracts.
- [ ] `libs/ddd/repository.port.ts` + `libs/ddd/mapper.interface.ts` — `toDomain()` / `toPersistence()` / `toResponse()`.
- [ ] `libs/db/sql-repository.base.ts` — `SqlRepositoryBase`; publishes aggregate events INSIDE the DB transaction (`05-infrastructure-layer.md`).
- [ ] `libs/ports/logger.port.ts` — `LoggerPort` DI token.
- [ ] `libs/exceptions/` — `exception.base.ts` + `ArgumentInvalidException`, `NotFoundException`, `ConflictException` (THROWN technical failures only).
- [ ] `libs/guard.ts`, `libs/utils/`, `libs/decorators/` — guard clauses and shared helpers.
- [ ] Inject **time and id generation** as ports — domain never reads `Date.now()` / random directly (`03-domain-layer.md`).
- [ ] Unit-test the base classes (equality, event buffering, guard failures) before any module depends on them.

## Phase 4 — AI-agent-first scaffolding (Required)

This is the differentiator — it lets any agent extend the repo without breaking layering (`08-ai-agent-first.md`).

- [ ] `AGENTS.md` (repo root, universal): layer + dependency rules, file-naming map, allowed dependencies per layer, exact commands (build/test/lint/scaffold/migrate), do / do-not list, and "where do I add a new use case".
- [ ] `CLAUDE.md` (repo root, Claude Code specific): same guardrails, plus the default model `claude-sonnet-4-6` and the LlmPort rule (SDK is always an adapter).
- [ ] `.dependency-cruiser.cjs`: forbid inner→outer imports, forbid cross-module imports (modules talk via command/query bus or events only), forbid domain importing any framework / IO / SDK.
- [ ] `plopfile.cjs`: deterministic generators for a full vertical slice — command + handler + controller + request/response DTOs + query side — so any agent emits an identical, correct slice (`10-module-scaffold-prompt.md`).
- [ ] **CI guardrail step**: run `depcruise`, `eslint` (incl. boundaries + naming), `tsc --noEmit`, and tests on every PR so an agent cannot silently break layering (`07-cross-cutting.md`).
- [ ] Add a naming lint rule enforcing the file map (`*.command.ts`, `*.service.ts`, `*.query-handler.ts`, `*.repository.ts`, `*.mapper.ts`, `*.http.controller.ts`, `*.request.dto.ts`, `*.response.dto.ts`, `*.domain-event.ts`, `*.errors.ts`).
- [ ] **Session harness** (`13-harness-engineering.md`): `feature_list.json` seeded from the planned use cases (all `"todo"`); `init.sh` (install → build → lint → arch → test → DB/migrate → e2e → harness-file presence); `session-handoff.md`, `claude-progress.md`, `clean-state-checklist.md` skeletons; `scripts/check-architecture.sh` greps wired into `pnpm arch`. Do this BEFORE the first slice — the first slice is built under the harness.

## Phase 5 — Scaffold the first bounded context + use-case slice (Required)

Use the generator from Phase 4 so the structure is exact. Folder map per `02-folder-structure.md`.

- [ ] `plop module <context>` — creates `modules/<context>/` with `domain/`, `commands/`, `queries/`, `application/event-handlers/`, `database/`.
- [ ] Build the domain first (`03-domain-layer.md`):
  - [ ] `domain/<aggregate>.entity.ts` with static `create()` factory and invariant `validate()`.
  - [ ] Value objects only for primitives with real rules (`<vo>.value-object.ts`) — YAGNI otherwise.
  - [ ] `domain/<event>.domain-event.ts` and `domain/<context>.errors.ts` (e.g. `UserAlreadyExistsError`) returned via `Result`.
- [ ] Build the write slice `commands/<use-case>/` (`04-application-layer.md`):
  - [ ] `<use-case>.command.ts` (state-changing intent).
  - [ ] `<use-case>.service.ts implements ICommandHandler<Cmd>` returning `Result<Success, DomainError>`.
  - [ ] `<use-case>.request.dto.ts` (class-validator) + `<use-case>.response.dto.ts` (intended fields only).
  - [ ] `<use-case>.http.controller.ts` — dispatches via `commandBus.execute()`, then `match()`es the Result and maps domain errors to HTTP status (409 / 400 / 404 …) per `06-interface-layer.md`.
- [ ] Build a read slice `queries/<use-case>/` — `*.query.ts` + `*.query-handler.ts implements IQueryHandler`; the read side MAY bypass domain/repository and hit the DB directly for performance.
- [ ] Confirm the **Command → Event → Command** rule: never call a command from a command directly; use a `*.domain-event-handler.ts` in `application/event-handlers/`.

## Phase 6 — Wire CQRS module, DI tokens, config, exception filter, logger (Required)

- [ ] Register `CqrsModule` + `EventEmitterModule` in the context module; register handlers, controllers, repositories.
- [ ] Define **DI tokens** for every port (e.g. `USER_REPOSITORY`, `LOGGER_PORT`, `LLM_PORT`) and bind them to concrete adapters in the module providers.
- [ ] Wire `@nestjs/config` with a **zod-validated** config schema; fail fast on boot if env is invalid (`07-cross-cutting.md`).
- [ ] Register a **global exception filter** mapping THROWN exceptions to responses; business errors stay as returned `Result` values (`01-architecture-principles.md`).
- [ ] Wire `nestjs-pino` as the `LoggerPort` implementation; inject via token, never import pino in domain/application.
- [ ] Add a global `ValidationPipe` (whitelist + transform) so request DTOs are validated and stripped at the edge.

## Phase 7 — Persistence + first migration (Required)

Per `05-infrastructure-layer.md`.

- [ ] Write the **persistence model / ORM schema** kept SEPARATE from the domain entity.
- [ ] Implement `<aggregate>.mapper.ts` — `toDomain()`, `toPersistence()`, `toResponse()`.
- [ ] Implement `<aggregate>.repository.ts implements <aggregate>.repository.port.ts`, extending `SqlRepositoryBase`.
- [ ] Ensure the repository calls `publishEvents()` INSIDE the DB transaction so events and state commit atomically.
- [ ] Create the **first migration** (Slonik raw SQL migration or TypeORM/Prisma migration) and a repeatable migrate script.
- [ ] Add a local stack (`docker-compose.yml` with the SQL engine) so dev and CI run against the same DB version.
- [ ] Smoke-test: create an aggregate through the command, read it back through the query side.

## Phase 8 — Tests + coverage gate (Required)

Per `09-testing-strategy.md`.

- [ ] **Unit** (Jest): domain entities/value-objects/services, command handlers with mocked ports — assert `Ok`/`Err` outcomes and invariant violations.
- [ ] **Integration** (Jest): repository + mapper against a real test DB; verify events publish in-transaction.
- [ ] **Acceptance / e2e**: Cucumber/Gherkin features driving `supertest` against the HTTP controller; assert mapped status codes (409 / 400 / 404).
- [ ] Add a **coverage gate** in CI (fail under threshold) so agents cannot merge untested slices.
- [ ] Add a test that asserts the **dependency-cruiser** rules pass — layering is part of the test suite, not just a lint nicety.

## Phase 9 — Observability + security hardening (Prod-only)

- [ ] Structured request logging + correlation/trace ids through `LoggerPort` (Prod-only).
- [ ] Health / readiness endpoints and graceful shutdown (Prod-only).
- [ ] Metrics + tracing exporters behind ports (Optional / Prod-only).
- [ ] Secret management: env via secret store, never committed; rotate the Anthropic API key (Prod-only).
- [ ] Rate limiting, helmet/security headers, input size limits at the interface layer (Prod-only).
- [ ] CI security scan (dependency audit) on PRs (Optional).

## Phase 10 — Add the AI agent bounded context (Required for AI features)

A first-class `modules/ai-agent/` context; the LLM is ALWAYS an adapter behind a port (`08-ai-agent-first.md`).

- [ ] `modules/ai-agent/domain/`: `Agent`, `Conversation`, `Message`, `Tool`, `PromptTemplate` as entities / value-objects with invariants.
- [ ] `application/ports/llm.port.ts` — `LlmPort` interface (prompt in, structured completion / tool-calls out); domain & application NEVER import `@anthropic-ai/sdk`.
- [ ] `adapters/claude-llm.adapter.ts` — `ClaudeLlmAdapter implements LlmPort` using `@anthropic-ai/sdk`; anti-corruption layer translating SDK types to domain types.
  - [ ] Default model `claude-sonnet-4-6`; allow `claude-opus-4-8` (deep reasoning), `claude-haiku-4-5-20251001` (fast/cheap), `claude-fable-5` via config — never legacy `claude-3-*`.
- [ ] Implement **tool-calling** as domain `Tool` definitions invoked through the port; results flow back as `Message`s.
- [ ] Bind the `LLM_PORT` DI token to `ClaudeLlmAdapter` in the module providers; mock the port in tests.
- [ ] `modules/ai-agent/evals/` — eval cases for prompt/agent quality (Experimental → promote to CI when stable).
- [ ] `modules/ai-agent/guardrails/` — input/output guardrails (PII, injection, refusal handling) at the adapter boundary.
- [ ] Add an acceptance feature exercising a full conversation turn with a stubbed `LlmPort`, asserting deterministic mapping (`09-testing-strategy.md`).

---

## Final check (before declaring "first slice done")

- [ ] One command (`plop ...`) regenerates an identical, correct vertical slice.
- [ ] `depcruise`, `eslint` (boundaries + naming), `tsc --noEmit`, and tests are green in CI.
- [ ] No domain or application file imports a framework, IO, or SDK; cross-module calls go through bus/events only.
- [ ] Business errors are returned as `Result<T,E>`; technical failures are thrown and mapped by the global filter.
- [ ] `AGENTS.md` + `CLAUDE.md` accurately describe the commands, file map, and "where do I add a new use case".
- [ ] The AI agent context talks to Claude only through `LlmPort` / `ClaudeLlmAdapter` with model `claude-sonnet-4-6` by default.
- [ ] `bash init.sh` passes end-to-end on a fresh clone; `feature_list.json` reflects reality (statuses have runtime evidence); `session-handoff.md` + `clean-state-checklist.md` current (`13-harness-engineering.md`).

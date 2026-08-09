# Folder Structure — Canonical Layout

This file is the single source of truth for WHERE every file lives. Layer responsibilities and
the contents of each building block are detailed in `03-domain-layer.md`, `04-application-layer.md`,
`05-infrastructure-layer.md`, and `06-interface-layer.md`; this file owns the *tree*, the
*naming convention*, and the *priority* of each path.

The structure is **vertical-slice-first**: a bounded context is a module (a mini app), and inside it
each use case is a self-contained folder holding its interface adapter (controller + DTOs), its
application orchestration (command/query + handler), and references to the domain it touches. Files
that change together live together (Common Closure); modules never import each other (talk via
CommandBus / QueryBus / EventBus). Enforce all of this with `dependency-cruiser` (see
`07-cross-cutting.md`).

## Output Scaling

The tree below is a CEILING for a multi-context production app. Adapt depth to size:

- **Small / single context**: one `modules/<context>/`, a few slices, skip GraphQL/CLI/message
  controllers, skip `evals/` and `guardrails/`. YAGNI applies — see `01-architecture-principles.md`.
- **Standard**: 2–4 modules, the AI-agent module if the product is AI-shaped, full `libs/`.
- **Enterprise / multi-agent**: every folder shown, plus per-context migrations, acceptance suites,
  and CI architecture guardrails wired as shown in `09-testing-strategy.md`.

## 1. Full `src/` Tree

```
project-root/
├── AGENTS.md                       # universal agent rules (layers, naming, commands)
├── CLAUDE.md                       # Claude Code specific entrypoint (links AGENTS.md)
├── .dependency-cruiser.cjs         # layer + cross-module import guardrails
├── nest-cli.json                   # Nest monorepo: projects + libs paths
├── package.json                    # scripts: build/test/lint/arch/plop/migrate
├── tsconfig.json                   # path aliases: @libs/*, @modules/*, @contracts/*
├── tsconfig.build.json
├── .eslintrc.cjs                   # eslint boundaries + naming lint
├── .env.example                    # every env key, no secrets (validated by zod/joi)
├── plopfile.cjs                    # deterministic slice/module scaffolds
├── docker-compose.yml              # postgres + app for local/integration
├── Dockerfile
├── jest.config.ts                  # unit
├── jest-e2e.config.ts              # integration / acceptance
├── cucumber.cjs                    # Gherkin runner config
├── src/
│   ├── main.ts                     # bootstrap: Nest app, global filter, config
│   ├── app.module.ts               # imports every context module + libs
│   ├── libs/                       # shared kernel — see §4
│   │   ├── ddd/
│   │   │   ├── entity.base.ts
│   │   │   ├── aggregate-root.base.ts
│   │   │   ├── value-object.base.ts
│   │   │   ├── domain-event.base.ts
│   │   │   ├── repository.port.ts
│   │   │   ├── mapper.interface.ts
│   │   │   ├── command.base.ts
│   │   │   └── query.base.ts
│   │   ├── db/
│   │   │   └── sql-repository.base.ts   # SqlRepositoryBase (Slonik), tx + publishEvents
│   │   ├── ports/
│   │   │   ├── logger.port.ts
│   │   │   └── llm.port.ts              # canonical LlmPort + LLM_PORT token (adapter lives in modules/ai-agent)
│   │   ├── exceptions/
│   │   │   ├── exception.base.ts
│   │   │   ├── argument-invalid.exception.ts
│   │   │   ├── not-found.exception.ts
│   │   │   ├── conflict.exception.ts
│   │   │   ├── forbidden.exception.ts
│   │   │   ├── unauthorized.exception.ts
│   │   │   ├── business-outcome.exception.ts   # outcome-body pass-through (06 §5)
│   │   │   └── exception.filter.ts             # global filter: outcome bodies + error envelope
│   │   ├── decorators/                  # e.g. @ApiErrorResponse, param decorators
│   │   ├── utils/
│   │   └── guard.ts                     # Guard helper for value-object validation
│   └── modules/
│       ├── user/                        # bounded context == module == mini app
│       │   ├── user.module.ts           # wires controllers, handlers, repo, port tokens
│       │   ├── user.di-tokens.ts        # injection tokens (USER_REPOSITORY, ...)
│       │   ├── domain/                  # innermost — ZERO framework/IO. See 03-domain-layer.md
│       │   │   ├── user.entity.ts
│       │   │   ├── address.value-object.ts   # value objects live FLAT in domain/ (no value-objects/ folder)
│       │   │   ├── email.value-object.ts
│       │   │   ├── events/                   # domain events live in domain/events/
│       │   │   │   ├── user-created.domain-event.ts
│       │   │   │   └── user-address-updated.domain-event.ts
│       │   │   ├── user.errors.ts       # UserAlreadyExistsError, returned via Result
│       │   │   └── user.types.ts        # CreateUserProps, UserProps
│       │   ├── commands/                # write slices (one folder per use case)
│       │   │   └── create-user/
│       │   │       ├── create-user.command.ts
│       │   │       ├── create-user.service.ts        # implements ICommandHandler
│       │   │       ├── create-user.http.controller.ts
│       │   │       ├── create-user.cli.controller.ts
│       │   │       ├── create-user.message.controller.ts
│       │   │       ├── create-user.request.dto.ts
│       │   │       └── create-user.service.spec.ts
│       │   ├── queries/                 # read slices (may bypass domain — see 04)
│       │   │   └── find-users/
│       │   │       ├── find-users.query.ts
│       │   │       ├── find-users.query-handler.ts   # implements IQueryHandler
│       │   │       ├── find-users.http.controller.ts
│       │   │       ├── find-users.request.dto.ts
│       │   │       └── find-users.response.dto.ts
│       │   ├── application/
│       │   │   ├── ports/
│       │   │   │   └── user.repository.port.ts       # extends RepositoryPort<UserEntity>
│       │   │   └── event-handlers/
│       │   │       └── welcome-user-when-created.domain-event-handler.ts
│       │   ├── dtos/
│       │   │   └── user.response.dto.ts              # shared response shape for the context
│       │   └── database/                # infrastructure — see 05-infrastructure-layer.md
│       │       ├── user.repository.ts               # implements port, extends SqlRepositoryBase
│       │       ├── user.mapper.ts                   # toDomain/toPersistence/toResponse
│       │       └── user.persistence.model.ts       # ORM/SQL model (separate from entity)
│       └── ai-agent/                    # owns the LLM ADAPTER + provides LLM_PORT; the LlmPort
│           │                            # interface lives in libs/ports. See 08-ai-agent-first.md
│           ├── ai-agent.module.ts
│           ├── ai-agent.di-tokens.ts
│           ├── domain/
│           │   ├── agent.entity.ts                  # AggregateRoot
│           │   ├── conversation.entity.ts
│           │   ├── message.value-object.ts          # VOs flat in domain/
│           │   ├── tool.value-object.ts
│           │   ├── prompt-template.value-object.ts
│           │   ├── events/
│           │   │   └── message-added.domain-event.ts
│           │   └── ai-agent.errors.ts
│           ├── commands/
│           │   └── send-message/
│           │       ├── send-message.command.ts
│           │       ├── send-message.service.ts
│           │       ├── send-message.http.controller.ts
│           │       └── send-message.request.dto.ts
│           ├── application/
│           │   └── ports/
│           │       └── tool-registry.port.ts        # context-local ports only — LlmPort is in libs/ports
│           ├── adapters/
│           │   └── claude-llm.adapter.ts            # ClaudeLlmAdapter — @anthropic-ai/sdk; bound to LLM_PORT here
│           ├── evals/                               # prompt/agent eval suites
│           └── guardrails/                          # input/output safety checks
├── tests/
│   ├── integration/                   # Jest + real DB (testcontainers/compose)
│   ├── e2e/                           # supertest HTTP end-to-end
│   ├── builders/                      # test data builders (object mothers)
│   └── setup/                         # shared bootstrap (testcontainers, Nest test module)
├── features/                          # *.feature (Gherkin) + step-definitions/ (acceptance)
└── migrations/                        # SQL migrations (Slonik/node-pg-migrate)
```

## 2. The Use-Case Slice, File by File

A slice lives at `modules/<context>/commands/<use-case>/` (or `queries/<use-case>/`). It is the
unit an agent scaffolds, reviews, and tests as a whole. Each file:

| File | Layer | Responsibility |
| --- | --- | --- |
| `<use-case>.command.ts` | Application | State-changing intent (a plain data class extending `Command`); carries the validated inputs. See `04-application-layer.md`. |
| `<use-case>.service.ts` | Application | `implements ICommandHandler<Cmd>`; orchestrates domain entity + repository port; returns `Result<Success, DomainError>`. |
| `<use-case>.query.ts` | Application | Read intent (queries only); extends `Query` / `PaginatedQueryBase`. |
| `<use-case>.query-handler.ts` | Application | `implements IQueryHandler<Q>`; MAY bypass domain + repository and hit the read model / DB directly for performance. |
| `<use-case>.http.controller.ts` | Interface | REST endpoint; dispatches via `commandBus.execute()` / `queryBus.execute()`, then `match()`es the Result and renders business rejections as outcome bodies (`BusinessOutcomeException`, `06-interface-layer.md` §5); technical failures go to the global filter. |
| `<use-case>.cli.controller.ts` | Interface | Same intent driven from CLI (`nest-commander`). Optional. |
| `<use-case>.message.controller.ts` | Interface | Same intent driven from a broker message / event. Optional. |
| `<use-case>.graphql-resolver.ts` | Interface | GraphQL field resolver, same dispatch pattern. Optional. |
| `<use-case>.request.dto.ts` | Interface | Inbound shape with `class-validator` decorators; constructs the Command. |
| `<use-case>.response.dto.ts` | Interface | Outbound shape exposing ONLY intended fields (mapper `toResponse`). |
| `<use-case>.service.spec.ts` | Test | Unit test for the handler against a fake repository. |

**Why a slice colocates interface + application references to domain:** the inputs, the
orchestration, and the HTTP/error mapping for a single behaviour all change together. Colocating
them follows Common Closure and lets an agent (or human) add a feature by touching exactly one
folder, with no hunting across mirrored `controllers/`, `services/`, `dtos/` trees. The slice still
respects the dependency rule — the controller imports the command, the service imports the domain
and the repository **port**, and nothing imports outward. Domain code is shared across slices and
therefore lives in the context-level `domain/`, not in any single slice (`03-domain-layer.md`).

## 3. Repo-Root & Infrastructure Files

| Path | Purpose | Priority |
| --- | --- | --- |
| `AGENTS.md` | Universal agent contract: layer + dependency rules, file-naming map, allowed dependencies, exact build/test/lint/scaffold/migrate commands, do/do-not list, "where to add a new use case". See `08-ai-agent-first.md`. | Required |
| `CLAUDE.md` | Claude Code entrypoint; thin, links `AGENTS.md`, names default model `claude-sonnet-4-6`. | Required |
| `.dependency-cruiser.cjs` | Forbids inner→outer imports, cross-module imports, and SDK imports in domain/application. Runs in CI. | Required |
| `nest-cli.json` | Monorepo config: `projects` + `libs` source roots and compiler options. | Required |
| `package.json` | Scripts: `build`, `test`, `test:e2e`, `lint`, `arch` (dep-cruiser), `plop` (scaffold), `migrate`. Pin `engines.node >= 20` (NestJS 11 baseline; Node 22 LTS recommended). | Required |
| `tsconfig.json` | Path aliases (`@libs/*`, `@modules/*`, `@contracts/*` → `libs/contracts/*`) so slices import the shared kernel cleanly. | Required |
| `.eslintrc.cjs` | `eslint-plugin-boundaries` + naming-convention rules mirroring the table in §5. | Required |
| `.env.example` | Every env key with empty/placeholder values; the real schema is validated by `@nestjs/config` + zod/joi at boot. | Required |
| `plopfile.cjs` | Deterministic generators: a single command produces an identical, correct module or vertical slice. | Required |
| `docker-compose.yml` / `Dockerfile` | Local Postgres + app; reused by integration tests. | Required |
| `migrations/` | Versioned SQL migrations applied by `migrate` script. | Required |
| `tests/integration/`, `tests/e2e/`, `features/` | Jest integration, supertest e2e, Cucumber/Gherkin acceptance suites. See `09-testing-strategy.md`. | Required |
| `jest.config.ts` / `jest-e2e.config.ts` / `cucumber.cjs` | Test runner configs. | Required |

The plop template enforces the slice shape so scaffolding is reproducible:

```bash
# generate a new write slice in an existing context
pnpm plop slice -- --context user --name create-user
# generate a whole new bounded context with domain + database scaffolding
pnpm plop module -- --context billing
```

## 4. `libs/` — Shared Kernel

`libs/` holds the framework-agnostic DDD building blocks every module reuses. Modules import `libs/`;
`libs/` imports nothing from `modules/`. **This table is the export canon** — the names each `libs/`
package exports; modules import only these.

| Path | Contents | Priority |
| --- | --- | --- |
| `libs/ddd/` | `entity.base.ts`, `aggregate-root.base.ts`, `value-object.base.ts`, `domain-event.base.ts`, `repository.port.ts`, `mapper.interface.ts`, `command.base.ts`, `query.base.ts`. Also exports `IdResponse`, `Paginated`, `PaginatedQueryBase`, `AggregateID`. | Required |
| `libs/db/` | `sql-repository.base.ts` — `SqlRepositoryBase` (Slonik): transaction handling + `publishEvents()` INSIDE the tx. Exports the `DB_POOL` token. | Required |
| `libs/ports/` | Tech-agnostic ports shared across contexts: `logger.port.ts`, `llm.port.ts` (canonical `LlmPort` + `LLM_PORT` token; adapter + binding owned by `modules/ai-agent`). | Required |
| `libs/contracts/<owner-context>/` | Cross-context query classes (contract-only communication, `14-design-first.md` §3.2) — imported via the `@contracts/*` alias (`@contracts/* → libs/contracts/*`). | Required |
| `libs/config/` | zod-validated config module — the ONLY place that reads `process.env` (`07-cross-cutting.md`). | Required |
| `libs/observability/` | `request-context.ts` — request-scoped correlation context. | Required |
| `libs/exceptions/` | `exception.base.ts` + `ArgumentInvalidException`, `NotFoundException`, `ConflictException`, `ForbiddenException`, `UnauthorizedException` (THROWN technical failures; rendered as the error envelope by `exception.filter.ts`, the global filter) + `BusinessOutcomeException` (outcome-body pass-through, `06-interface-layer.md` §5). | Required |
| `libs/decorators/` | Reusable param/method decorators (e.g. API error response). | Optional |
| `libs/utils/` | Pure helpers (no IO). | Optional |
| `libs/guard.ts` | `Guard` helper used by value objects to validate in their constructor. | Required |

## 5. File-Naming Convention Table

Directories are **kebab-case**. File names are kebab-case with a descriptive dot-suffix that encodes
the building block. An agent maps a concept to a filename purely from this table — the eslint naming
rule enforces it.

| Building Block | File Suffix / Name | Example |
| --- | --- | --- |
| Entity | `*.entity.ts` | `user.entity.ts` |
| Aggregate root base | `aggregate-root.base.ts` | `libs/ddd/aggregate-root.base.ts` |
| Value object | `*.value-object.ts` | `address.value-object.ts` |
| Repository (infra impl) | `*.repository.ts` | `user.repository.ts` |
| Repository port (interface) | `*.repository.port.ts` | `user.repository.port.ts` |
| Command | `*.command.ts` | `create-user.command.ts` |
| Command handler / service | `*.service.ts` | `create-user.service.ts` |
| Query | `*.query.ts` | `find-users.query.ts` |
| Query handler | `*.query-handler.ts` | `find-users.query-handler.ts` |
| HTTP controller | `*.http.controller.ts` | `create-user.http.controller.ts` |
| CLI controller | `*.cli.controller.ts` | `create-user.cli.controller.ts` |
| Message controller | `*.message.controller.ts` | `create-user.message.controller.ts` |
| GraphQL resolver | `*.graphql-resolver.ts` | `create-user.graphql-resolver.ts` |
| Request DTO | `*.request.dto.ts` | `create-user.request.dto.ts` |
| Response DTO | `*.response.dto.ts` | `user.response.dto.ts` |
| Domain event | `*.domain-event.ts` | `user-created.domain-event.ts` |
| Domain-event handler | `*.domain-event-handler.ts` | `welcome-user-when-created.domain-event-handler.ts` |
| Mapper | `*.mapper.ts` | `user.mapper.ts` |
| Persistence model | `*.persistence.model.ts` | `user.persistence.model.ts` |
| Domain errors | `*.errors.ts` | `user.errors.ts` |
| Port (generic) | `*.port.ts` | `llm.port.ts`, `logger.port.ts` |
| Adapter | `*.adapter.ts` | `claude-llm.adapter.ts` |
| Base class | `*.base.ts` | `entity.base.ts`, `sql-repository.base.ts` |
| Decorator | descriptive name in `decorators/` | `libs/decorators/api-error-response.decorator.ts` |
| Exception | `*.exception.ts` | `conflict.exception.ts` |
| DI tokens | `*.di-tokens.ts` | `user.di-tokens.ts` |
| Nest module | `*.module.ts` | `user.module.ts` |
| Test (unit) | `*.spec.ts` | `create-user.service.spec.ts` |
| Acceptance feature | `*.feature` | `create-user.feature` |

> **Command-handler naming.** This set always names the command handler `*.service.ts` (e.g.
> `create-user.service.ts`); the `*.command-handler.ts` form used in some DDD codebases is **not**
> used here. Pick one suffix and let the naming lint enforce it.

## 6. Folder-by-Folder Priority Table

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `src/main.ts` | App bootstrap | Nest factory, global exception filter, config validation | Required |
| `src/app.module.ts` | Composition root | imports of all context modules + libs | Required |
| `src/libs/ddd/` | DDD primitives | base classes, ports, command/query bases | Required |
| `src/libs/db/` | SQL repo base | `SqlRepositoryBase`, tx + event publishing | Required |
| `src/libs/exceptions/` | Exceptions + wire shapes | base exception + Conflict/NotFound/ArgumentInvalid/Forbidden/Unauthorized, `BusinessOutcomeException`, global `exception.filter.ts` | Required |
| `src/libs/ports/` | Shared ports | `logger.port.ts` | Required |
| `src/libs/decorators/`, `src/libs/utils/` | Cross-cutting helpers | reusable decorators, pure utils | Optional |
| `modules/<context>/` | One bounded context | module file, di-tokens, the layer folders below | Required |
| `modules/<context>/domain/` | Innermost layer | entities, value-objects, events, errors (no IO) | Required |
| `modules/<context>/commands/<use-case>/` | Write slice | command, service, controllers, request DTO, spec | Required |
| `modules/<context>/queries/<use-case>/` | Read slice | query, query-handler, controller, request/response DTO | Required |
| `modules/<context>/application/ports/` | App ports | `*.repository.port.ts`, other infra interfaces | Required |
| `modules/<context>/application/event-handlers/` | Domain-event handlers | `*.domain-event-handler.ts` (Command→Event→Command) | Required |
| `modules/<context>/dtos/` | Shared context DTOs | response shapes reused across slices | Optional |
| `modules/<context>/database/` | Infrastructure | repository impl, mapper, persistence model | Required |
| `modules/ai-agent/` | AI bounded context | Agent/Conversation domain, `ClaudeLlmAdapter` (binds `LLM_PORT`; `LlmPort` interface in `libs/ports`) | Optional |
| `modules/ai-agent/adapters/` | Anti-corruption layer | `claude-llm.adapter.ts` (`@anthropic-ai/sdk`, `claude-sonnet-4-6`) | Optional |
| `modules/ai-agent/evals/`, `.../guardrails/` | AI quality + safety | eval suites, input/output guardrails | Experimental |
| `migrations/` | Schema versioning | SQL migration files | Required |
| `tests/integration/` | Integration tests | Jest + real DB via compose/testcontainers | Required |
| `tests/e2e/`, `features/` | e2e + acceptance tests | supertest specs, `.feature` (Gherkin) + step-definitions | Required |
| Root guardrail files | Architecture enforcement | `.dependency-cruiser.cjs`, `.eslintrc.cjs` | Required |
| `AGENTS.md`, `CLAUDE.md`, `plopfile.cjs` | Agent-first scaffolding | rules + deterministic generators | Required |

## Cross-References

- Domain building-block internals (entity/value-object/aggregate/events/errors): `03-domain-layer.md`.
- Command/query/handler/port/event-handler internals and the Command→Event→Command rule: `04-application-layer.md`.
- Repository, mapper, persistence model, and adapter internals: `05-infrastructure-layer.md`.
- Controllers, DTOs, Result `match()`, and error-to-HTTP mapping: `06-interface-layer.md`.
- `dependency-cruiser` rules, eslint boundaries, config validation: `07-cross-cutting.md`.
- `AGENTS.md`/`CLAUDE.md` content, plop templates, the AI-agent context: `08-ai-agent-first.md`.

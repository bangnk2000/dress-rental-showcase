# Architecture Principles

This file defines the architectural foundations every module in this codebase obeys: **Domain-Driven Design (DDD)** + **Hexagonal (Ports & Adapters)** + **Clean Architecture** + **SOLID**, adapted to be AI-agent-first. It is the contract an AI coding agent reads before generating or modifying code.

- For the on-disk layout that realizes these layers, see `02-folder-structure.md`.
- For the building blocks of each layer, see `03-domain-layer.md`, `04-application-layer.md`, `05-infrastructure-layer.md`, `06-interface-layer.md`.
- For how these rules are machine-enforced (dependency-cruiser, eslint boundaries, scaffolding), see `08-ai-agent-first.md`.

**Output-Scaling note:** the full four-layer ceremony below is a CEILING. A small project SKIPs layers, value objects, and ports it does not need (see "Pragmatism / YAGNI"). Scale depth to the domain's real complexity, not to this document's length.

## 1. The Four Layers

A **module == a bounded context == a mini-app** bounded by a single context. Inside every module there are four layers. Dependencies point **inward**; outer layers know inner layers, never the reverse.

| Layer | One-line responsibility | Knows about | Lives in |
| --- | --- | --- | --- |
| **Domain** (innermost) | Business rules, invariants, and identity — zero framework / IO / SDK code. | Nothing outside itself. | `modules/<context>/domain/` |
| **Application** | Orchestrates use cases via CQRS; defines ports; returns `Result<T,E>`. | Domain + its own ports. | `modules/<context>/commands/`, `queries/`, `application/` |
| **Infrastructure** | Implements ports — repositories, mappers, adapters (DB, LLM, queues). | Application ports + Domain. | `modules/<context>/database/`, `adapters/` |
| **Interface Adapters** (outermost) | Translates the outside world (HTTP/CLI/GraphQL/messages) into commands/queries and back. | Application (bus) + Response DTOs. | inside each use-case slice (`*.http.controller.ts`, etc.) |

Notes:
- Infrastructure and Interface sit on the **same outer ring**. Infrastructure *implements* Application ports; Interface *drives* the Application via the `CommandBus`/`QueryBus`.
- The **Domain has ZERO dependencies** on NestJS, `@anthropic-ai/sdk`, Slonik/TypeORM, the clock, or randomness. Time and ids are **injected**, never read directly in domain code.

## 2. The Dependency Rule (inward only)

> Source code dependencies point only **inward**. An inner layer NEVER names anything in an outer layer.

```
            ┌───────────────────────────────────────────────┐
            │            Interface Adapters                  │
            │   *.http.controller / *.cli.controller /       │
            │   *.graphql-resolver / request+response DTOs   │
            │        ┌─────────────────────────────────┐     │
            │        │          Application            │      │
   drives → │        │  Commands / Queries / Handlers  │      │
   (bus)    │        │  Ports (repository/logger/llm)  │      │
            │        │     ┌───────────────────┐       │      │
            │        │     │      Domain       │       │      │
            │        │     │ Entity/Aggregate  │       │      │
            │        │     │ ValueObject/Event │       │      │
            │        │     │  Errors/Services  │       │      │
            │        │     └───────────────────┘       │      │
            │        └─────────────────────────────────┘      │
            └───────────────────────────────────────────────┘
              ▲ Infrastructure implements Application ports
              │ (Repository extends SqlRepositoryBase,
              │  ClaudeLlmAdapter implements LlmPort)
              └── dependency arrows ALL point INWARD ─────────►
```

The arrows of *control* can flow outward at runtime (a handler calls a port whose implementation lives in infrastructure), but the **compile-time import** always points inward. This is achieved by **Dependency Inversion**: the Application owns the port *interface*; Infrastructure owns the *implementation*; DI wires them by token.

## 3. Who May Import Whom

Allowed (`✓`) / forbidden (`✗`) import directions. Rows = importer, columns = imported. Cells marked **[CI]** are machine-enforced by **dependency-cruiser** + eslint boundaries (see `08-ai-agent-first.md`); a violation fails the build.

| Importer ↓ \ Imported → | Domain | Application | Infrastructure | Interface | libs/ddd, libs/exceptions | NestJS / SDK / ORM |
| --- | --- | --- | --- | --- | --- | --- |
| **Domain** | ✓ (own context) | ✗ **[CI]** | ✗ **[CI]** | ✗ **[CI]** | ✓ (pure base classes only) | ✗ **[CI]** |
| **Application** | ✓ | ✓ | ✗ **[CI]** | ✗ **[CI]** | ✓ | ✓ `@nestjs/cqrs`, `oxide.ts` (no DB/SDK) |
| **Infrastructure** | ✓ | ✓ (ports) | ✓ | ✗ **[CI]** | ✓ (`libs/db`) | ✓ (Slonik/TypeORM, `@anthropic-ai/sdk`) |
| **Interface** | ✓ (Response mapping only) | ✓ (bus, DTOs) | ✗ **[CI]** | ✓ | ✓ | ✓ (`@nestjs/common` HTTP) |

Key forbidden edges, all **[CI]**-enforced:
- **Domain → anything outer** — the cardinal rule. No `@nestjs/*`, no SDK, no ORM, no other layer.
- **Application → Infrastructure** — handlers depend on `*.port.ts`, never on a concrete `*.repository.ts` or `ClaudeLlmAdapter`. Inversion happens via DI tokens.
- **Interface → Infrastructure** — controllers go through the bus; they never touch repositories or adapters.
- **Any module → another module's internals** — see §4.

## 4. Module Privacy (no cross-module imports)

A module is a **closed bounded context**. Modules NEVER import each other's domain, application, or infrastructure code. This is **[CI]**-enforced by dependency-cruiser.

Modules communicate only through:
1. **Command / Query bus with shared contract classes** — one module dispatches another's use case via `commandBus.execute(...)` / `queryBus.execute(...)`. The deliberately exposed command/query classes live in `libs/contracts/<owner-context>/`: the owner implements the handler, consumers dispatch the class, **both sides import `libs/`, neither imports the other** (see `14-design-first.md` §3.2). The contract is named, typed, and greppable.
2. **Domain / integration events** — a module publishes an event (`EventBus` / `@nestjs/event-emitter`); other modules subscribe with their own handlers.
3. **Anti-Corruption Layer (ACL)** — when integrating an **external** system, an **adapter** translates the foreign model into this module's terms (e.g. `ClaudeLlmAdapter implements LlmPort`). The foreign shape never leaks inward.

> MUST NOT: an adapter or query handler in one module reading **another module's database
> tables**. That is cross-context coupling moved to the schema layer, where dependency-cruiser
> cannot see it — a column rename in the owning context silently breaks the reader. If a module
> needs another context's data, that is channel 1 (a contract query) — not a `SELECT` across the
> boundary. See `14-design-first.md` §3.2.

> RULE: **Command → Event → Command.** A command handler MUST NOT call another command handler directly. It changes state, emits a domain event, and a domain-event handler (in `application/event-handlers/`) issues the next command. This keeps each use case atomic and traceable. See `04-application-layer.md`.

## 5. Ports & Adapters (Hexagonal)

- A **Port** (`*.port.ts`) is an interface *owned by the Application layer* that abstracts an outside capability: `RepositoryPort`, `LoggerPort`, `LlmPort`. It is the application's vocabulary, expressed without any infrastructure detail. Injected via a DI token.
- An **Adapter** is the Infrastructure implementation of a port: a `*.repository.ts` extending `SqlRepositoryBase`, or a `ClaudeLlmAdapter` wrapping `@anthropic-ai/sdk` (default model `claude-sonnet-4-6`). Swapping Slonik for TypeORM, or Claude for another provider, changes only the adapter — the application is untouched.
- **Driving (primary) adapters** push input *into* the hexagon: controllers, resolvers, message consumers. **Driven (secondary) adapters** are what the hexagon pushes *out to*: repositories, the LLM adapter, message publishers.

```ts
// application: the port (owned by the inner layer)
export interface LlmPort {
  complete(req: LlmCompletionRequest): Promise<Result<LlmCompletion, LlmRefusalError>>;
}
export const LLM_PORT = Symbol('LLM_PORT');

// infrastructure: the adapter (outer layer implements the inner interface)
@Injectable()
export class ClaudeLlmAdapter implements LlmPort {
  private readonly model = 'claude-sonnet-4-6';
  async complete(req: LlmCompletionRequest): Promise<Result<LlmCompletion, LlmRefusalError>> { /* ...SDK call... */ }
}
```

Domain and Application layers NEVER import the SDK; the LLM is always behind `LlmPort`. See `05-infrastructure-layer.md` and `08-ai-agent-first.md`.

## 6. SOLID, as applied here

| Principle | How it shows up |
| --- | --- |
| **S**ingle Responsibility | One handler per use case (one `*.service.ts` / `*.query-handler.ts`); mapper, controller, DTO each do one job. |
| **O**pen/Closed | Add behavior by adding a new vertical slice (`commands/<new-use-case>/`), not by editing existing handlers. |
| **L**iskov Substitution | Any adapter satisfying a port is interchangeable (Slonik ⇄ TypeORM repo; Claude ⇄ alt LLM adapter). |
| **I**nterface Segregation | Small, purpose-specific ports (`LoggerPort`, `LlmPort`, `RepositoryPort`) — no god-interface. |
| **D**ependency Inversion | Application depends on port *abstractions*; Infrastructure depends on them too and provides implementations via DI. This is what makes the Dependency Rule physically possible. |

## 7. Error Handling Discipline

- **Business / domain errors are RETURNED**, not thrown. They are recoverable, explicit, and documented in the return type as `Result<T, DomainError>` (via `oxide.ts` `Ok`/`Err` or `@badrap/result`). Example: `UserAlreadyExistsError` flows back from a handler; the controller `match()`es it to **409 Conflict**.
- **Technical failures are THROWN** (fail-fast): DB down, malformed config, broken invariant that should never occur. A **global exception filter** maps thrown exceptions (`ConflictException`, `NotFoundException`, `ArgumentInvalidException` from `libs/exceptions`) to HTTP responses.
- Rule of thumb: *if a caller can sensibly react to it, return a `Result`; if not, throw.* See `04-application-layer.md` and `06-interface-layer.md`.

## 8. Pragmatism / YAGNI — when to SKIP

The architecture is a ceiling. **Do not over-engineer small projects.** Apply the lightest structure that still upholds the Dependency Rule.

- **Value Objects:** create one only for a primitive with **real rules** (e.g. `Email`, `Money`). A plain `string` name with no invariant stays a `string`. Do not wrap every field.
- **Ports:** introduce a port only where it **earns its keep** — a genuine seam you will swap, mock, or that crosses an IO boundary (DB, LLM, network). Don't port pure in-process helpers.
- **CQRS split:** keep commands and queries separate, but a simple read MAY bypass the domain/repository and hit the DB directly in the query handler for performance. That is by design, not a violation.
- **Layers:** a trivial CRUD context can collapse to a thin slice; you still keep domain logic out of controllers, but you don't manufacture aggregates, domain services, and event handlers it doesn't need.
- **Events:** use domain events when there is real cross-aggregate or cross-module reaction. For a single atomic write, skip the ceremony.
- **Infrastructure earns its keep:** build an outbox/relay only when an event has a real consumer; build a policy/permission registry only when there are more than two roles with different rights. Publishing 20 events nobody consumes, or a full ABAC engine for two roles, is cost with no buyer — wire the seam when the need arrives, not before.

The one rule you NEVER skip, at any size: **the Dependency Rule and module privacy** — they are CI-enforced. Everything else scales with the domain.

## 9. Smells / Violations — agent self-check

Before finishing a change, an agent should confirm NONE of these are present:

- `import` of `@nestjs/*`, `@anthropic-ai/sdk`, Slonik/TypeORM/Prisma, or `Date.now()`/`crypto.randomUUID()` **inside `domain/`**.
- An Application handler importing a concrete `*.repository.ts` or `*.adapter.ts` instead of a `*.port.ts`.
- A controller or resolver importing a repository/adapter, or doing business logic instead of dispatching through the bus.
- A `*.command.service.ts` calling another command handler directly (should be Command → Event → Command).
- A module importing another module's `domain/`, `application/`, or `database/` files (cross-module import).
- A `SELECT`/query in one module naming **another module's table** — schema-level cross-context coupling (§4 MUST NOT); route it through a contract query in `libs/contracts/`.
- A critical uniqueness/overlap/capacity invariant enforced only by a read-then-write check in a handler, with **no DB constraint** backing it — the race window is open (`14-design-first.md` §3.1).
- A domain entity exposing **public setters** or mutable state instead of behavior methods + `validate()`.
- Persistence/ORM model shape leaking into the domain (entity and persistence model must stay separate, bridged by a `*.mapper.ts`).
- Throwing for an expected business-rule failure instead of returning `Result` with a domain error (or vice-versa).
- A Response DTO leaking internal fields the API never intended to expose.
- Using an outdated model id (e.g. `claude-3-*`) instead of the current ids; default app model must be `claude-sonnet-4-6`.

If any smell is present, the layering is broken — fix it before relying on CI. See `08-ai-agent-first.md` for the guardrails that will otherwise reject the change.

# 04 — Application Layer (CQRS, Ports, Event Handlers)

The Application layer is the **orchestration ring**. It sits between Interface Adapters
(`06-interface-layer.md`) and the Domain (`03-domain-layer.md`). It coordinates the domain to
fulfill a use case, but contains **no business rules** of its own. Every state-changing use case is
a `Command`; every read is a `Query`. Both are dispatched over the bus, decoupling controllers from
handlers.

Dependencies point **inward**: this layer may import Domain, but never Infrastructure concretions —
it depends on **ports** (interfaces) that `05-infrastructure-layer.md` implements. It must never
import a controller, an ORM, or the LLM SDK.

> **NestJS version.** Targets `@nestjs/cqrs` **^11** (NestJS 11 line). `CommandBus`, `QueryBus`,
> `ICommandHandler`, `IQueryHandler`, `@CommandHandler`, and `@QueryHandler` are stable from v10→v11.
> v11 can infer a command's result type when the command extends the framework's `Command<TResult>`;
> this set keeps its own `Command` base (`libs/ddd`) plus an explicit `Result<Success, DomainError>`
> return type, which documents domain errors more clearly than an inferred success type.

> **Output-Scaling note.** This file is the CEILING. A 3-table CRUD service does not need
> domain-event handlers, a saga, or read-side projections — wire a single `*.service.ts` per
> command and stop. Add event handlers, ports, and CQRS read models only when the domain earns
> them. Do not scaffold empty slices.

## What belongs here vs. the Domain

| Concern | Application layer | Domain layer |
| --- | --- | --- |
| Load aggregate by id, save it | Yes (via repository port) | No |
| Open/commit the DB transaction | Yes (handler owns the boundary) | No |
| Decide *if* an email is unique | Calls `repo.exists()`, returns `Err` | No |
| Decide *what makes* an order valid | No | Yes (`validate()`, invariants) |
| Compute price, apply discount rules | No | Yes (entity/domain service) |
| Map `Result` to an HTTP status | No (that is `06`) | No |
| Inject clock / id generator | Yes (passes into `create()`) | Consumes injected values |

Rule of thumb: if deleting the database would invalidate the logic, it is **orchestration** (here).
If it would still be true on paper, it is a **business rule** (Domain).

## Vertical slice layout

A module is a bounded context. Each use case is a folder containing everything that changes
together (Common Closure). Controllers and DTOs live *inside* the slice (see `06`).

```
modules/user/
├── commands/
│   └── create-user/
│       ├── create-user.command.ts
│       ├── create-user.service.ts          # ICommandHandler<CreateUserCommand>
│       ├── create-user.request.dto.ts      # interface adapter — see 06
│       └── create-user.http.controller.ts  # interface adapter — see 06
├── queries/
│   └── find-users/
│       ├── find-users.query.ts
│       ├── find-users.query-handler.ts     # IQueryHandler<FindUsersQuery>
│       └── find-users.response.dto.ts
├── application/
│   ├── ports/
│   │   └── user.repository.port.ts          # LLM slices consume LlmPort from @libs/ports — no per-module llm port file
│   └── event-handlers/
│       └── user-created.domain-event-handler.ts
├── domain/                                  # see 03-domain-layer.md
└── database/                                # see 05-infrastructure-layer.md
```

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `commands/<use-case>/` | One write use case | command, service, DTOs, controller | Required |
| `queries/<use-case>/` | One read use case | query, query-handler, response DTO | Required |
| `application/ports/` | Infra abstractions (DI tokens) | `*.repository.port.ts`; shared ports (`logger.port.ts`, `llm.port.ts`) are consumed from `@libs/ports` | Required |
| `application/event-handlers/` | Domain-event reactions | `*.domain-event-handler.ts` | Optional |
| `application/services/` | Multi-aggregate orchestration not tied to one command | cross-aggregate coordinators | Optional |

## Command (`*.command.ts`)

A command is an immutable, serializable description of intent. It carries primitives/DTO data, never
domain objects. Extend `Command` from `libs/ddd` (see `02-folder-structure.md`).

```ts
// commands/create-user/create-user.command.ts
import { Command, CommandProps } from '@libs/ddd';

export class CreateUserCommand extends Command {
  readonly email: string;
  readonly country: string;
  readonly postalCode: string;
  readonly street: string;

  constructor(props: CommandProps<CreateUserCommand>) {
    super(props);
    this.email = props.email;
    this.country = props.country;
    this.postalCode = props.postalCode;
    this.street = props.street;
  }
}
```

## Command Handler / Service (`*.service.ts`)

The handler implements `ICommandHandler<Cmd>` and returns a `Result<Success, DomainError>` — it
**never throws** for business-rule violations; it throws only for technical failures
(see `07-cross-cutting.md`). It owns the transaction boundary and orchestrates: validate input →
guard against the DB → call the domain factory/method → persist → return.

```ts
// commands/create-user/create-user.service.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, Ok, Err } from 'oxide.ts';
import { AggregateID } from '@libs/ddd';
import { CreateUserCommand } from './create-user.command';
import { UserEntity } from '../../domain/user.entity';
import { Email } from '../../domain/email.value-object';
import { Address } from '../../domain/address.value-object';
import { UserAlreadyExistsError } from '../../domain/user.errors';
import {
  UserRepositoryPort,
  USER_REPOSITORY,
} from '../../application/ports/user.repository.port';

export type CreateUserResult = Result<AggregateID, UserAlreadyExistsError>;

@CommandHandler(CreateUserCommand)
export class CreateUserService
  implements ICommandHandler<CreateUserCommand, CreateUserResult>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepositoryPort,
  ) {}

  async execute(command: CreateUserCommand): Promise<CreateUserResult> {
    // 1. Guard the uniqueness precondition against the DB. A recoverable conflict is RETURNED.
    const existing = await this.userRepo.findOneByEmail(command.email);
    if (existing) return Err(new UserAlreadyExistsError()); // returned, not thrown

    // 2. Build value objects (they throw ArgumentInvalidException on malformed input), then call
    //    the domain factory with an injected id + time. It enforces invariants and emits
    //    UserCreatedDomainEvent — see 03-domain-layer.md for the create() signature.
    const user = UserEntity.create(
      {
        email: Email.create(command.email),
        address: new Address({
          country: command.country,
          postalCode: command.postalCode,
          street: command.street,
        }),
      },
      this.userRepo.nextId(),
      new Date(), // injected at the edge; the domain never reads the clock
    );

    // 3. Persist inside a transaction; the repository publishes the aggregate's events INSIDE
    //    that transaction (see 05-infrastructure-layer.md). Then return the new identity only.
    await this.userRepo.insert(user);
    return Ok(user.id);
  }
}
```

Key points:

- **Return, do not throw, business errors.** The `Result` return type documents every recoverable
  failure the caller must handle. Technical faults (DB down, serialization error) propagate as
  thrown exceptions and are mapped by the global filter.
- **Map success to id/metadata only.** Return the `AggregateID` (or a small metadata object), never
  the whole entity. The Response DTO is built in the controller (`06`).
- **No business logic here.** The handler only *orchestrates*: it checks the uniqueness precondition
  through the repository port and returns a typed `Err`. The rule itself (and the DB unique
  constraint backing it) lives in the domain/infrastructure, not in branching logic here.

### Transaction boundary ownership

The **handler** defines the unit of work; the **repository** executes it. The repository
(`SqlRepositoryBase` in `libs/db`) wraps `insert`/`update` in a transaction and calls
`aggregate.publishEvents()` **inside** that transaction, so domain events and state commit
atomically (see `05`). One command = one aggregate saved = one transaction. To touch a second
aggregate, do **not** save it here — emit a domain event and let an event handler issue the next
command.

## The Command → Event → Command rule

A command handler must **never** call another command directly. Cross-aggregate workflows are
chained through domain events, keeping each transaction small and each handler single-purpose.

```
CreateUserCommand ─▶ CreateUserService
        │ saves User, publishes UserCreatedDomainEvent (in txn)
        ▼
UserCreatedDomainEventHandler ─▶ commandBus.execute(CreateWalletCommand)
        │
        ▼
CreateWalletService  (its own aggregate, its own transaction)
```

This prevents nested transactions, keeps modules decoupled (events cross slice boundaries; direct
calls would not), and makes each step independently testable and retryable. When the next command
targets **another** bounded context (as `CreateWalletCommand` does), its class is published in a
shared **contracts** module (e.g. `@contracts/*` or `libs/contracts/`); the handler imports that
contract, never the other module's internal files — so the no-cross-module guardrail still holds.

## Domain-event handlers (`application/event-handlers/`)

Handlers react to domain events published by aggregates. They implement `IEventHandler<Event>` and
typically translate an event into the **next** command. Keep them thin — no business logic.

```ts
// application/event-handlers/user-created.domain-event-handler.ts
import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs';
import { UserCreatedDomainEvent } from '../../domain/events/user-created.domain-event';
// Cross-context command imported from a SHARED contracts module — NOT from wallet's internals.
// Importing `modules/wallet/...` directly would trip dependency-cruiser's no-cross-module rule.
import { CreateWalletCommand } from '@contracts/wallet/create-wallet.command';

@EventsHandler(UserCreatedDomainEvent)
export class UserCreatedDomainEventHandler
  implements IEventHandler<UserCreatedDomainEvent>
{
  constructor(private readonly commandBus: CommandBus) {}

  async handle(event: UserCreatedDomainEvent): Promise<void> {
    // Command → Event → Command. Never call a command from a command directly.
    await this.commandBus.execute(
      new CreateWalletCommand({ userId: event.aggregateId }),
    );
  }
}
```

> Integration events that leave the process (webhooks, message bus) belong in Infrastructure
> adapters subscribing to these handlers — keep transport concerns out of the application layer.

## Query (`*.query.ts`) + Query Handler (`*.query-handler.ts`)

The read side is optimized for retrieval and **may bypass the domain and the repository**, hitting
the database directly (raw SQL / a read view) for performance. Queries return plain read models, not
aggregates — so the heavy load/map cycle is skipped.

```ts
// queries/find-users/find-users.query.ts
import { PaginatedQueryBase } from '@libs/ddd';

export class FindUsersQuery extends PaginatedQueryBase {
  readonly country?: string;
  readonly email?: string;

  constructor(props: Partial<FindUsersQuery>) {
    super(props);
    this.country = props.country;
    this.email = props.email;
  }
}
```

```ts
// queries/find-users/user-list-item.dto.ts
// Read model: EXPLICIT columns, shaped for the consumer. Never reuse the persistence model
// here — `SELECT *` through `UserModel` is how internal columns leak into the API.
import { z } from 'zod';

export const userListItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  country: z.string(),
  createdAt: z.string(),
});
export type UserListItemDto = z.infer<typeof userListItemSchema>;

export const countSchema = z.object({ count: z.number() }); // total-count row for pagination
```

```ts
// queries/find-users/find-users.query-handler.ts
import { Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Result, Ok } from 'oxide.ts';
import { DatabasePool, sql } from 'slonik';
import { Paginated } from '@libs/ddd';
import { DB_POOL } from '@libs/db';
import { FindUsersQuery } from './find-users.query';
import { UserListItemDto, userListItemSchema, countSchema } from './user-list-item.dto';

@QueryHandler(FindUsersQuery)
export class FindUsersQueryHandler
  implements IQueryHandler<FindUsersQuery, Result<Paginated<UserListItemDto>, Error>>
{
  constructor(@Inject(DB_POOL) private readonly pool: DatabasePool) {}

  // Read side: go straight to the DB. No aggregate, no repository, no domain.
  async execute(query: FindUsersQuery): Promise<Result<Paginated<UserListItemDto>, Error>> {
    // Conditional filter = an EMPTY fragment when absent. (`WHERE country = country` looks
    // equivalent but silently drops rows where country IS NULL — NULL = NULL is not true.)
    const countryFilter = query.country
      ? sql.fragment`WHERE country = ${query.country}`
      : sql.fragment``;

    const records = await this.pool.query(sql.type(userListItemSchema)`
      SELECT id, email, country, created_at AS "createdAt" FROM users
      ${countryFilter}
      LIMIT ${query.limit} OFFSET ${query.offset}
    `);

    // rowCount is the PAGE size, not the total — a separate COUNT(*) supplies the true total.
    const total = await this.pool.oneFirst(sql.type(countSchema)`
      SELECT count(*)::int AS count FROM users ${countryFilter}
    `);

    return Ok(
      new Paginated({
        data: [...records.rows],
        count: total,
        limit: query.limit,
        page: query.page,
      }),
    );
  }
}
```

The query handler still returns a `Result` for API symmetry (the controller `unwrap()`s it — see
`06-interface-layer.md` §6), but its work is read-only and never opens a write transaction.

## Ports and the DI-token pattern (`*.port.ts`)

A port is an interface that abstracts an external capability. The application layer depends on the
port; Infrastructure provides the implementation (`05`). Because TS interfaces vanish at runtime,
inject via a **string/Symbol DI token** colocated with the interface.

```ts
// application/ports/user.repository.port.ts
import { RepositoryPort } from '@libs/ddd';
import { UserEntity } from '../../domain/user.entity';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepositoryPort extends RepositoryPort<UserEntity> {
  findOneByEmail(email: string): Promise<UserEntity | null>;
}
```

> `RepositoryPort<T>` (in `libs/ddd`) supplies the primitives every repository shares — `insert(entity)`,
> `save(entity)` (upsert), `findOneById(id)`, `delete(entity)`, and `nextId()` (id generation belongs to
> infrastructure, never the domain). A context-specific port only adds finders like `findOneByEmail`.

```ts
// modules/user/user.module.ts (wiring — see 05 for the adapter)
{
  provide: USER_REPOSITORY,
  useClass: UserRepository, // implements UserRepositoryPort, extends SqlRepositoryBase
}
```

| Port | Token | Implemented by (see `05`) | Priority |
| --- | --- | --- | --- |
| `*.repository.port.ts` | `USER_REPOSITORY` | `UserRepository extends SqlRepositoryBase` | Required |
| `logger.port.ts` (in `libs/ports`) | `LOGGER_PORT` | `PinoLoggerAdapter` | Required |
| `llm.port.ts` (in `libs/ports` — shared) | `LLM_PORT` | `ClaudeLlmAdapter` (`@anthropic-ai/sdk`; bound in `modules/ai-agent`) | Optional |

### The LLM port

For AI-agent use cases, the application layer consumes `LlmPort` from `@libs/ports` (shared port;
adapter bound in `modules/ai-agent`) — it **never** imports `@anthropic-ai/sdk`. The adapter
(`ClaudeLlmAdapter`, default model `claude-sonnet-4-6`) lives in Infrastructure and is the
anti-corruption boundary. The `LlmPort` interface and its
`LlmCompletionRequest` / `LlmCompletion` / `LlmRefusalError` types are defined once in
`08-ai-agent-first.md` and implemented by the adapter in `05-infrastructure-layer.md`:

```ts
// libs/ports/llm.port.ts — full type definitions in 08-ai-agent-first.md
import { Result } from 'oxide.ts';

export const LLM_PORT = Symbol('LLM_PORT'); // DI token

export interface LlmPort {
  complete(req: LlmCompletionRequest): Promise<Result<LlmCompletion, LlmRefusalError>>;
}
```

## DTOs

DTOs mediate between the outside world and the application layer. **Request DTOs**
(`*.request.dto.ts`, `class-validator`) are validated in the interface ring and mapped to a command;
**Response DTOs** (`*.response.dto.ts`) expose only intended fields. Both are owned by the slice but
described in `06-interface-layer.md` — do not duplicate that content here.

## Checklist for a new use case

- [ ] Write command (`*.command.ts`) or query (`*.query.ts`) — primitives only.
- [ ] Implement `*.service.ts` (`ICommandHandler`) returning `Result<Success, DomainError>`, or
      `*.query-handler.ts` (`IQueryHandler`) reading the DB directly.
- [ ] Orchestrate only: load aggregate, call a domain method, persist via the repository port.
- [ ] Return `Ok(id/metadata)`; return `Err(DomainError)` for business failures; throw for technical.
- [ ] Chain follow-on work via Command → Event → Command, never command → command.
- [ ] Register handler/port in the module; wire ports by DI token.
- [ ] Cover with a unit test (mock the ports) — see `09-testing-strategy.md`.

> Generate this slice deterministically with the scaffolder (`plop` / Nest schematic) rather than by
> hand — see `10-module-scaffold-prompt.md`.

# Infrastructure Layer

The infrastructure layer is the **outer ring that implements the ports declared in the Application layer** (see 04-application-layer.md). It is where the system touches the real world: SQL, ORMs, message brokers, email, and the Anthropic SDK. Nothing inward of this ring may import it; it depends on Application (for the port interfaces it implements) and on Domain (for the entities it maps to/from), never the other way around.

Two responsibilities live here:

1. **Persistence** — repositories, persistence models / ORM schema, mappers, migrations, transactions/unit-of-work. Located in `modules/<context>/database/`.
2. **External adapters** — anti-corruption layers around third-party systems (email, payments, LLM). Located in `modules/<context>/adapters/` (or a shared `libs/` adapter when reused across contexts).

> **Output-Scaling note.** The full apparatus below (separate persistence model + mapper + repository base + unit-of-work) is the CEILING for a complex SQL domain. A small CRUD module on Prisma can collapse the mapper into the repository and skip the persistence-model split. Add ceremony only when a context has real invariants worth protecting. See 01-architecture-principles.md (YAGNI).

## Directory shape

```
modules/<context>/
├── database/
│   ├── <context>.repository.ts          # implements <context>.repository.port.ts
│   ├── <context>.mapper.ts              # toDomain / toPersistence / toResponse
│   ├── <context>.persistence.model.ts   # DB row shape — SEPARATE from the entity
│   └── sql/                             # raw SQL (Slonik) or ORM schema files
├── adapters/
│   └── claude-llm.adapter.ts            # implements llm.port.ts (see 08-ai-agent-first.md)
└── <context>.module.ts                  # DI: binds port tokens -> implementations
```

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `database/*.repository.ts` | Persist + load aggregate roots | `extends SqlRepositoryBase`, implements the port | Required |
| `database/*.mapper.ts` | Translate entity <-> row <-> response | `toDomain/toPersistence/toResponse` | Required |
| `database/*.persistence.model.ts` | DB row contract | column types, schema-validation guard | Required (SQL) |
| `database/sql/` | Schema + queries | Slonik SQL fragments or ORM entities | Required |
| `adapters/*.adapter.ts` | Anti-corruption layer for external IO | SDK calls behind a port | Optional |
| `database/migrations/` | Versioned schema changes | up/down migration files | Required |

## Repository: implements a port, extends `SqlRepositoryBase`

A repository is the only place an aggregate root is loaded or saved. It implements the `*.repository.port.ts` interface owned by the Application layer (04-application-layer.md) and extends `SqlRepositoryBase` from `libs/db/sql-repository.base.ts`. The base owns the database pool, the mapper wiring, and — critically — **publishing the aggregate's domain events inside the same DB transaction** so events never fire for a write that rolled back.

```ts
// modules/user/database/user.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DatabasePool, sql } from 'slonik';
import { DB_POOL } from '@libs/db';
import { SqlRepositoryBase } from '@libs/db/sql-repository.base';
import { LOGGER_PORT, LoggerPort } from '@libs/ports/logger.port';
import { UserEntity } from '../domain/user.entity';
import { UserRepositoryPort } from '../application/ports/user.repository.port';
import { UserMapper } from './user.mapper';
import { UserModel, userSchema } from './user.persistence.model';

@Injectable()
export class UserRepository
  extends SqlRepositoryBase<UserEntity, UserModel>
  implements UserRepositoryPort
{
  protected tableName = 'users';
  protected schema = userSchema; // zod schema validating each row

  constructor(
    @Inject(DB_POOL) pool: DatabasePool,
    mapper: UserMapper,
    @Inject(LOGGER_PORT) logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ) {
    super(pool, mapper, logger, eventEmitter);
  }

  async findOneByEmail(email: string): Promise<UserEntity | null> {
    const query = sql.type(this.schema)`
      SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    const row = await this.pool.maybeOne(query);
    return row ? this.mapper.toDomain(row) : null;
  }
}
```

```ts
// libs/db/sql-repository.base.ts (shape — the shared kernel base)
export abstract class SqlRepositoryBase<
  Aggregate extends AggregateRoot<unknown>,
  Model,
  Response = unknown,
> implements RepositoryPort<Aggregate>
{
  protected abstract tableName: string;
  protected abstract schema: ZodSchema<Model>;

  constructor(
    // DB_POOL (from @libs/db) is an injection token — `DatabasePool` is an interface,
    // and an interface type alone is not injectable.
    @Inject(DB_POOL) protected readonly pool: DatabasePool,
    protected readonly mapper: Mapper<Aggregate, Model, Response>,
    @Inject(LOGGER_PORT) protected readonly logger: LoggerPort,
    protected readonly eventEmitter: EventEmitter2,
  ) {}

  /** Create a brand-new aggregate. */
  insert(entity: Aggregate): Promise<void> {
    return this.writeInTransaction(entity, (record) => this.insertRow(record));
  }

  /** Persist an existing aggregate (upsert). */
  save(entity: Aggregate): Promise<void> {
    return this.writeInTransaction(entity, (record) => this.upsertRow(record));
  }

  /** Infrastructure may generate ids; the domain never does (see 03-domain-layer.md). */
  nextId(): string {
    return crypto.randomUUID();
  }

  // insertRow / upsertRow: protected helpers the base implements over `this.pool` (bodies elided).

  private async writeInTransaction(
    entity: Aggregate,
    write: (record: Model) => Promise<void>,
  ): Promise<void> {
    // Run the write and the event publish in ONE transaction.
    await this.pool.transaction(async () => {
      const record = this.mapper.toPersistence(entity);
      await write(record);
      // publishEvents(logger, eventEmitter): events commit atomically with the write.
      await entity.publishEvents(this.logger, this.eventEmitter);
    });
  }
}
```

The rule that domain events publish **inside** the transaction is what makes the "Command -> Event -> Command" choreography of 04-application-layer.md safe: a downstream command handler only ever reacts to writes that durably happened.

## Persistence model separate from the domain entity — and why

The **persistence model** (`*.persistence.model.ts`) describes a database row; the **domain entity** describes business behaviour. They are deliberately different types:

- The entity has no public setters, protects invariants in `validate()`, and stores value objects (e.g. an `Email` VO). The row is a flat bag of scalars (`email: string`, `created_at: Date`).
- Decoupling lets the schema evolve (rename a column, denormalise, add an index) without touching domain code, and lets the domain refactor (split a VO) without a migration.
- It keeps the Domain layer free of ORM decorators and column metadata — the domain stays pure (zero framework/IO dependencies, per 03-domain-layer.md).

```ts
// modules/user/database/user.persistence.model.ts
import { z } from 'zod';

// A flat row of scalars — the Address value object is denormalised into columns here.
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  country: z.string(),
  postal_code: z.string(),
  street: z.string(),
  is_email_verified: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type UserModel = z.infer<typeof userSchema>;
```

## Mapper: `toDomain` / `toPersistence` / `toResponse`

The mapper is the single translation point between the three representations. It implements the 3-param `Mapper<Entity, Model, Response>` from `libs/ddd/mapper.interface.ts`. `toResponse()` produces the Response DTO consumed by controllers (06-interface-layer.md) and exposes only intended fields. Response DTOs are slice-local (`commands/<use-case>/<use-case>.response.dto.ts` — never a shared `dtos/` folder).

```ts
// modules/user/database/user.mapper.ts
import { Injectable } from '@nestjs/common';
import { Mapper } from '@libs/ddd/mapper.interface';
import { UserEntity } from '../domain/user.entity';
import { Email } from '../domain/email.value-object';
import { Address } from '../domain/address.value-object';
import { UserModel } from './user.persistence.model';
import { UserResponseDto } from '../commands/create-user/create-user.response.dto';

@Injectable()
export class UserMapper
  implements Mapper<UserEntity, UserModel, UserResponseDto>
{
  // Reconstitution: build the entity DIRECTLY (not via create()), so loading a row does
  // NOT re-emit the creation domain event. create() is reserved for genuinely new aggregates.
  toDomain(record: UserModel): UserEntity {
    return new UserEntity({
      id: record.id,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      props: {
        email: Email.create(record.email),
        address: new Address({
          country: record.country,
          postalCode: record.postal_code,
          street: record.street,
        }),
        isEmailVerified: record.is_email_verified,
      },
    });
  }

  toPersistence(entity: UserEntity): UserModel {
    const props = entity.getProps();
    const address = props.address.unpack();
    return {
      id: props.id,
      email: props.email.unpack(),
      country: address.country,
      postal_code: address.postalCode,
      street: address.street,
      is_email_verified: props.isEmailVerified,
      created_at: props.createdAt,
      updated_at: props.updatedAt,
    };
  }

  toResponse(entity: UserEntity): UserResponseDto {
    const props = entity.getProps();
    // Object.assign respects the Response DTO's readonly fields (see 06-interface-layer.md).
    return Object.assign(new UserResponseDto(), {
      id: props.id,
      email: props.email.unpack(),
      createdAt: props.createdAt.toISOString(),
    }); // isEmailVerified and other internal flags are NOT exposed
  }
}
```

## Adapters: the anti-corruption layer

An adapter implements an Application port for an external system and **translates that system's vocabulary into ours**, so a vendor's API shape never leaks inward. The example below implements `LlmPort` with the Anthropic SDK. Domain and Application code call `LlmPort`; only this file imports `@anthropic-ai/sdk`. Full Claude-specific guidance (tool-calling, evals, guardrails) lives in 08-ai-agent-first.md.

```ts
// modules/ai-agent/adapters/claude-llm.adapter.ts
import { Injectable, Inject } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { Ok, Err, Result } from 'oxide.ts';
import {
  LlmPort,
  LlmCompletionRequest,
  LlmCompletion,
  LlmRefusalError,
} from '@libs/ports/llm.port';
import { LOGGER_PORT, LoggerPort } from '@libs/ports/logger.port';

@Injectable()
export class ClaudeLlmAdapter implements LlmPort {
  private readonly client: Anthropic;
  // `req.model` is optional; the default comes from validated config, never hard-coded.
  private readonly defaultModel: string;

  constructor(
    config: ConfigService,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {
    // Missing key is a misconfiguration → fail fast at construction.
    this.client = new Anthropic({ apiKey: config.getOrThrow('ANTHROPIC_API_KEY') });
    this.defaultModel = config.getOrThrow('ANTHROPIC_MODEL'); // claude-sonnet-4-6 by default
  }

  // Canonical port shape — `LlmPort` in libs/ports/llm.port.ts (08-ai-agent-first.md).
  async complete(req: LlmCompletionRequest): Promise<Result<LlmCompletion, LlmRefusalError>> {
    try {
      const res = await this.client.messages.create({
        model: req.model ?? this.defaultModel,
        max_tokens: req.maxTokens,
        system: req.system,
        // Port roles ≠ SDK roles — translate explicitly: map (or exclude) 'tool' entries;
        // never pass the port's message array straight through.
        messages: req.messages
          .filter((m) => m.role !== 'tool')
          .map((m) => ({ role: m.role, content: m.content })),
      });
      // Domain-relevant: a safety refusal is a Result error the caller can recover from.
      if (res.stop_reason === 'refusal') return Err(new LlmRefusalError('model refused'));
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return Ok({
        text,
        model: res.model,
        usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      });
    } catch (err) {
      // Technical failure (network/5xx/rate-limit) → THROW (fail-fast); the global exception
      // filter renders it. Full LlmPort + tool-calling shape lives in 08-ai-agent-first.md.
      this.logger.error('Claude request failed', err);
      throw err;
    }
  }
}
```

Note the error policy (07-cross-cutting.md), consistent with `01-architecture-principles.md` and `08-ai-agent-first.md`: a transient/technical SDK failure (network, 5xx, rate-limit) is **thrown** (fail-fast) and rendered by the global exception filter; a misconfiguration (missing API key) is thrown at construction. Only a **domain-relevant** outcome — e.g. a safety **refusal** the caller can recover from — is RETURNED as a `Result` error (see the fuller `LlmPort` in `08-ai-agent-first.md`).

## Persistence choice: Slonik vs TypeORM/Prisma

| Concern | Slonik (raw SQL) | TypeORM / Prisma |
| --- | --- | --- |
| Best fit | Complex domains, hand-tuned queries, read-side performance | Simple CRUD, fast scaffolding |
| Query control | Full SQL, explicit | ORM DSL / generated client |
| Mapping | Manual mapper (you own it) | Conventional, less boilerplate |
| Type safety | Runtime row validation (zod) | Compile-time generated types |
| N+1 / leaks | Visible, you control them | Easy to hide |
| Migrations | SQL files via runner | CLI-generated migrations |

**Default to Slonik** for domains with real invariants and non-trivial reads; the manual mapper is a feature, not a tax, because it keeps the persistence model decoupled. Choose Prisma/TypeORM for thin CRUD contexts where speed of delivery outweighs query control. The choice is per-module — different bounded contexts may pick differently.

## Migrations

Schema is versioned from day one. With Slonik use a migration runner (e.g. `node-pg-migrate`) writing forward/back SQL; with Prisma use `prisma migrate`. Migrations live alongside the module or in a top-level `database/migrations/` and run in CI before integration tests (09-testing-strategy.md).

```bash
pnpm migrate:create add-users-table   # new migration
pnpm migrate                          # apply pending
pnpm migrate:down                     # roll back last
```

A migration is never edited after it ships; correct a mistake with a new migration. The persistence model and the migration must agree — the row schema (`userSchema`) is the contract both honour.

## Database-enforced invariants (MUST)

Every **critical** invariant — one whose violation corrupts business state: uniqueness,
non-overlap, capacity, balance bounds — is enforced by a **constraint in the migration**, not
only by application code (the full rule and the design-doc table it traces to live in
`14-design-first.md` §3.1):

- `UNIQUE` for one-of invariants (one active registration per user per event — a partial unique
  index with a `WHERE` clause covers "active only").
- `CHECK` for value bounds; foreign keys for referential rules.
- `EXCLUDE USING gist` (+ `btree_gist`) for range non-overlap — the double-booking class of
  invariant that a read-then-write check can never close, because two concurrent requests both
  pass the read.
- A **version column** (optimistic locking) or `SELECT ... FOR UPDATE` where two requests may
  save the same aggregate — mandatory when an aggregate is stored as single-row JSONB, where
  concurrent saves are silent lost updates.

Division of labour: the **handler pre-checks** the rule to return a precise domain error; the
**constraint enforces** it; the **repository catches the constraint violation** (unique/exclusion
error codes) and maps it to the same domain error the pre-check produces, so the race path
surfaces the same outcome body (`14-design-first.md` §3.1) — race path and friendly path are
indistinguishable to clients. Each constraint gets an
integration/e2e test that provokes it (`09-testing-strategy.md`).

## Transactions and unit-of-work

A single command must commit atomically. `SqlRepositoryBase` already wraps each `insert`/`save` (write + event publish) in one transaction. When one command must persist two writes atomically, put both inside `this.pool.transaction(async (tx) => ...)` exposed via a repository-base helper — the handler still calls ONE repository method; it never opens transactions itself:

```ts
// inside a repository method (Infrastructure) — both writes commit or neither does
await this.pool.transaction(async (tx) => {
  await this.insertRow(record, tx);
  await this.insertRow(auditRecord, tx);
});
```

A dedicated UnitOfWork port is YAGNI until a second cross-aggregate use case exists.

Keep transactions scoped to one aggregate root where possible (the consistency boundary, 03-domain-layer.md). Cross-aggregate consistency is achieved with domain events, not by widening the transaction.

## Wiring ports to adapters in the Nest module

DI binds a **port token** (an abstract class or symbol) to its concrete infrastructure class, using the `provide`/`useClass` form. The Application layer injects the token; it never names the implementation. This is the seam dependency-cruiser guards (08-ai-agent-first.md).

```ts
// modules/user/user.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserRepository } from './database/user.repository';
import { UserMapper } from './database/user.mapper';
import { USER_REPOSITORY } from './application/ports/user.repository.port';
import { CreateUserService } from './commands/create-user/create-user.service';

@Module({
  imports: [CqrsModule],
  providers: [
    UserMapper,
    CreateUserService,
    { provide: USER_REPOSITORY, useClass: UserRepository }, // port -> adapter
  ],
})
export class UserModule {}
```

```ts
// application/ports/user.repository.port.ts (the token + interface, defined in 04)
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export interface UserRepositoryPort extends RepositoryPort<UserEntity> {
  findOneByEmail(email: string): Promise<UserEntity | null>;
}
```

The handler then injects with `@Inject(USER_REPOSITORY)`. Swapping Slonik for Prisma, or `ClaudeLlmAdapter` for a fake in tests, is a one-line change in the module — the inner layers are untouched.

## Layer rules recap

- Infrastructure implements ports from 04-application-layer.md; it imports Application + Domain, never the reverse.
- Persistence model is **separate** from the domain entity; the mapper is the only bridge.
- Domain events publish **inside** the DB transaction.
- External systems are reached only through adapters behind ports (anti-corruption); the SDK import is confined to the adapter file.
- DI binds port tokens to implementations in `<context>.module.ts`; cross-module imports are forbidden (modules talk via command/query bus or events).
- A repository/adapter touches only **its own context's tables** — reading a sibling context's schema is the cross-module import rule evaded at the SQL layer (`01-architecture-principles.md` §4, `14-design-first.md` §3.2).
- Critical invariants live in **constraints**; the repository maps their violations to domain errors (see "Database-enforced invariants").

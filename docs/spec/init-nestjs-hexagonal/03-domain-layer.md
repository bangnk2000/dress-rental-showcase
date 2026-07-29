# 03 — Domain Layer

The **domain layer** is the innermost ring and the heart of every bounded context. It encodes
business rules and nothing else. It has **zero** dependencies on NestJS, the database, the
`@anthropic-ai/sdk`, HTTP, or any IO. Time and random ids are **injected**, never read directly.
This is the one layer where an AI agent must be most careful: a single `import` from `@nestjs/*`
or a repository here is an architecture violation and CI (dependency-cruiser) will fail the build.

This guide gives, for each building block: **purpose · rules · file name · TypeScript skeleton**.
Base classes live in `libs/ddd/` (see `02-folder-structure.md` for the tree and `07-cross-cutting.md`
for `Guard`, `exceptions`, and the `Result` setup). Domain files live in
`modules/<context>/domain/`.

> **Output Scaling.** The set of blocks below is a **ceiling**, not a mandate. A small CRUD module
> needs only an Entity + Errors. Reach for ValueObjects when a primitive has real rules, for
> AggregateRoot when you emit events, and for Domain Services only when logic spans entities.
> See the Required/Optional table at the end.

## Hard rules (non-negotiable)

- **Always-valid entities.** An object that exists is valid. `validate()` runs on every
  construction and mutation; invalid state is impossible to hold.
- **No anemic models.** Business logic lives **on the entity/aggregate**, not in services. If a
  handler reads an entity's fields to make a decision, that decision belongs on the entity.
- **Zero framework / IO / SDK deps.** No `@nestjs/*`, no Slonik/TypeORM/Prisma, no
  `@anthropic-ai/sdk`, no `fetch`, no `fs`. Pure TypeScript only.
- **Inject time and randomness.** Never call `Date.now()` or `crypto.randomUUID()` inside domain.
  Pass `id` and timestamps into `create()` so the domain stays deterministic and testable.
- **No public setters.** Mutate only through intention-revealing methods that re-validate.
- **Business errors are returned, not thrown.** Rule violations come back as `Err(...)` via
  `Result<T, E>`; only truly exceptional/technical states throw (see Domain Errors below).

## File-naming map

| Block | File name | Priority |
| --- | --- | --- |
| Entity | `user.entity.ts` | Required |
| Aggregate root | `user.entity.ts` (extends `AggregateRoot`) | Optional |
| Value object | `address.value-object.ts`, `email.value-object.ts` | Optional |
| Domain event | `user-created.domain-event.ts` | Optional |
| Domain errors | `user.errors.ts` | Required |
| Domain service | `transfer.domain-service.ts` | Experimental |
| Entity props type | colocated in `user.types.ts` or the entity file | Required |

---

## 1. Entity base — `entity.base.ts` (libs/ddd)

**Purpose.** An object defined by **identity**, not attributes. Two entities are equal iff their
ids are equal. It owns business logic and protects its invariants.

**Rules.** Readonly `id` / `createdAt` / `updatedAt`; props held private; equality by id; a static
`create()` factory that returns the entity (or a `Result` if creation can fail); a `validate()`
hook invoked on construction and after every mutation.

```ts
// libs/ddd/entity.base.ts
import { Guard } from '../guard';
import { ArgumentInvalidException } from '../exceptions';

export interface BaseEntityProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEntityProps<T> {
  id: string;
  props: T;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class Entity<EntityProps> {
  protected readonly _id: string;
  protected readonly props: EntityProps;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor({ id, createdAt, updatedAt, props }: CreateEntityProps<EntityProps>) {
    this._id = id;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this.props = props;
    this.validate(); // always-valid: invariants checked on construction
  }

  get id(): string {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Bump updatedAt after a state-changing method; time is provided by the caller. */
  protected setUpdatedAt(now: Date): void {
    this._updatedAt = now;
  }

  /** Frozen snapshot of identity + timestamps + props — the only read surface mappers use (see 05). */
  public getProps(): Readonly<EntityProps & BaseEntityProps> {
    return Object.freeze({
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      ...this.props,
    });
  }

  /** Identity equality — never structural. */
  public equals(object?: Entity<EntityProps>): boolean {
    if (object == null || !(object instanceof Entity)) return false;
    if (this === object) return true;
    return this._id === object._id;
  }

  /** Guards every invariant. Throw a technical exception on impossible state. */
  public abstract validate(): void;

  protected guardAgainstEmpty(value: unknown, field: string): void {
    if (Guard.isEmpty(value)) {
      throw new ArgumentInvalidException(`${field} must not be empty`);
    }
  }
}
```

**A concrete entity** — note the static `create()`, no setters, mutation via a method, injected
`id` + `now`:

```ts
// modules/user/domain/user.entity.ts
import { AggregateRoot, CreateEntityProps } from '@libs/ddd';
import { Result, Ok, Err } from 'oxide.ts';
import { Email } from './email.value-object';
import { Address } from './address.value-object';
import { UserCreatedDomainEvent } from './user-created.domain-event';
import { UserAddressUpdatedDomainEvent } from './user-address-updated.domain-event';
import { EmailAlreadyVerifiedError } from './user.errors';

export interface UserProps {
  email: Email;
  address: Address;
  isEmailVerified: boolean;
}

export interface CreateUserProps {
  email: Email;
  address: Address;
}

export class UserEntity extends AggregateRoot<UserProps> {
  /** Factory. Id + timestamps injected by the application layer (never read here). */
  static create(
    create: CreateUserProps,
    id: string,
    now: Date,
  ): UserEntity {
    const props: UserProps = { ...create, isEmailVerified: false };
    const user = new UserEntity({ id, props, createdAt: now, updatedAt: now });
    user.addEvent(
      new UserCreatedDomainEvent({ aggregateId: id, email: create.email.unpack() }),
    );
    return user;
  }

  get email(): Email {
    return this.props.email;
  }

  /** Intention-revealing mutation — re-validates, bumps time, emits an event. */
  updateAddress(address: Address, now: Date): void {
    this.props.address = address;
    this.setUpdatedAt(now);
    this.addEvent(new UserAddressUpdatedDomainEvent({ aggregateId: this.id }));
    this.validate();
  }

  /** Business rule returned as Result, not thrown. */
  verifyEmail(now: Date): Result<void, EmailAlreadyVerifiedError> {
    if (this.props.isEmailVerified) return Err(new EmailAlreadyVerifiedError());
    this.props.isEmailVerified = true;
    this.setUpdatedAt(now);
    return Ok(undefined);
  }

  public validate(): void {
    this.guardAgainstEmpty(this.props.email, 'email');
    this.guardAgainstEmpty(this.props.address, 'address');
  }
}
```

---

## 2. AggregateRoot base — `aggregate-root.base.ts` (libs/ddd)

**Purpose.** The **consistency boundary** and the only object loaded/saved from the DB. It extends
`Entity` and collects **domain events** to be dispatched after the change commits.

**Rules.** Only aggregate roots are persisted by repositories. `addEvent()` queues events;
`publishEvents()` is called by the repository **inside the DB transaction** (see
`05-infrastructure-layer.md`). Other entities are reached only through their root.

```ts
// libs/ddd/aggregate-root.base.ts
import { Entity } from './entity.base';
import { DomainEvent } from './domain-event.base';
import { LoggerPort } from '../ports/logger.port';
import { EventEmitter2 } from '@nestjs/event-emitter';

export abstract class AggregateRoot<EntityProps> extends Entity<EntityProps> {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): DomainEvent[] {
    return this._domainEvents;
  }

  protected addEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Called by the repository AFTER the write succeeds, INSIDE the transaction,
   * so side effects only run when the aggregate is durably saved.
   */
  public async publishEvents(
    logger: LoggerPort,
    eventEmitter: EventEmitter2,
  ): Promise<void> {
    await Promise.all(
      this.domainEvents.map((event) => {
        logger.debug(`"${event.constructor.name}" event published for ${this.id}`);
        return eventEmitter.emitAsync(event.constructor.name, event);
      }),
    );
    this.clearEvents();
  }
}
```

> `EventEmitter2` is imported by the **base class in libs**, not by a concrete domain entity — the
> domain entity only ever calls `addEvent()`. Wiring lives outside the inner ring.

---

## 3. ValueObject base — `value-object.base.ts` (libs/ddd)

**Purpose.** A concept with **no identity**, compared by **value**. Immutable, self-validating,
replaceable. Use VOs only for primitives that carry real rules (`Email`, `Money`, `Address`) — do
**not** wrap every string (YAGNI).

**Rules.** Validate in the constructor with `Guard`; structural equality; no mutation (return a new
instance for changes); never expose internal state via setters.

```ts
// libs/ddd/value-object.base.ts
export type Primitives = string | number | boolean;
export interface DomainPrimitive<T extends Primitives | Date> {
  value: T;
}
type ValueObjectProps<T> = T extends Primitives | Date ? DomainPrimitive<T> : T;

export abstract class ValueObject<T> {
  protected readonly props: ValueObjectProps<T>;

  constructor(props: ValueObjectProps<T>) {
    this.validate(props); // immutable + always-valid
    this.props = props;
  }

  protected abstract validate(props: ValueObjectProps<T>): void;

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) return false;
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  public unpack(): T {
    if (this.isDomainPrimitive(this.props)) return this.props.value;
    return Object.freeze({ ...(this.props as object) }) as T;
  }

  private isDomainPrimitive(obj: unknown): obj is DomainPrimitive<T & (Primitives | Date)> {
    return Object.prototype.hasOwnProperty.call(obj, 'value');
  }
}
```

**An `Email` VO** (single-primitive) and an **`Address` VO** (multi-field):

```ts
// modules/user/domain/email.value-object.ts
import { ValueObject, DomainPrimitive, Guard, ArgumentInvalidException } from '@libs/ddd';

export class Email extends ValueObject<string> {
  protected validate({ value }: DomainPrimitive<string>): void {
    if (Guard.isEmpty(value) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      throw new ArgumentInvalidException('Invalid email');
    }
  }
  static create(value: string): Email {
    return new Email({ value: value.trim().toLowerCase() });
  }
}
```

```ts
// modules/user/domain/address.value-object.ts
import { ValueObject, Guard, ArgumentInvalidException } from '@libs/ddd';

export interface AddressProps {
  country: string;
  postalCode: string;
  street: string;
}

export class Address extends ValueObject<AddressProps> {
  get country(): string {
    return this.props.country;
  }

  protected validate(props: AddressProps): void {
    if (Guard.isEmpty(props.country) || Guard.isEmpty(props.street)) {
      throw new ArgumentInvalidException('Address fields must not be empty');
    }
  }
}
```

> VOs guard **format/shape** invariants and throw `ArgumentInvalidException` (a technical fault: a
> caller passed garbage). **Business-rule** violations (e.g. "email already taken") are not a VO's
> job — those are Domain Errors returned as `Result` from a handler. See `07-cross-cutting.md` for
> the exception hierarchy.

---

## 4. Domain Events — `*.domain-event.ts`

**Purpose.** A record that **something happened** in the domain. Used to decouple aggregates and to
trigger downstream work. Per the orchestration rule (see `04-application-layer.md`):
**Command → Event → Command** — a command never calls another command directly.

**Rules.** Past tense, immutable, carries the `aggregateId` and only the data subscribers need. No
behaviour. Extends `DomainEvent` from `libs/ddd`.

```ts
// libs/ddd/domain-event.base.ts
export interface DomainEventProps {
  aggregateId: string;
}

export abstract class DomainEvent {
  public readonly aggregateId: string;
  constructor(props: DomainEventProps) {
    this.aggregateId = props.aggregateId;
  }
}
```

```ts
// modules/user/domain/user-created.domain-event.ts
import { DomainEvent, DomainEventProps } from '@libs/ddd';

export class UserCreatedDomainEvent extends DomainEvent {
  public readonly email: string;
  constructor(props: DomainEventProps & { email: string }) {
    super(props);
    this.email = props.email;
  }
}
```

Handlers for these live in `modules/<context>/application/event-handlers/` as
`*.domain-event-handler.ts` — see `04-application-layer.md`.

---

## 5. Domain Errors — `*.errors.ts`

**Purpose.** Represent **business-rule violations** as first-class, explicit, recoverable values
**returned** via `Result<T, E>` — never thrown. The caller `match()`es them and the controller maps
them to HTTP status (see `06-interface-layer.md`: `UserAlreadyExistsError → 409 Conflict`).

**Rules.** Extend a small `ExceptionBase` (from `libs/exceptions`, see `07-cross-cutting.md`) so the
error carries a stable `code` and `message`, but it is **used as a value**, not raised. One file per
context groups its errors.

```ts
// modules/user/domain/user.errors.ts
import { ExceptionBase } from '@libs/exceptions';

export class UserAlreadyExistsError extends ExceptionBase {
  static readonly message = 'User already exists';
  public readonly code = 'USER.ALREADY_EXISTS';
  constructor(cause?: Error, metadata?: unknown) {
    super(UserAlreadyExistsError.message, cause, metadata);
  }
}

export class EmailAlreadyVerifiedError extends ExceptionBase {
  static readonly message = 'Email is already verified';
  public readonly code = 'USER.EMAIL_ALREADY_VERIFIED';
  constructor(cause?: Error, metadata?: unknown) {
    super(EmailAlreadyVerifiedError.message, cause, metadata);
  }
}
```

Used in a handler (full example in `04-application-layer.md`):

```ts
const existing = await this.userRepo.findOneByEmail(email);
if (existing) return Err(new UserAlreadyExistsError()); // returned, not thrown
```

---

## 6. Domain Services — `*.domain-service.ts`

**Purpose.** Multi-entity / multi-aggregate logic that fits **no single entity**. Reach for this
**only** when behaviour genuinely spans objects (e.g. transferring balance between two accounts).
Most logic belongs on an entity — a domain service is the exception, not the default.

**Rules.** Pure: takes domain objects in, returns domain objects / `Result` out. No repositories, no
IO, no framework. If it needs to load or save, that orchestration belongs in an application service.

```ts
// modules/wallet/domain/transfer.domain-service.ts
import { Result, Ok, Err } from 'oxide.ts';
import { WalletEntity } from './wallet.entity';
import { InsufficientFundsError } from './wallet.errors';

export class TransferService {
  /** Pure multi-aggregate rule; time injected, no IO. */
  transfer(
    from: WalletEntity,
    to: WalletEntity,
    amount: number,
    now: Date,
  ): Result<void, InsufficientFundsError> {
    const withdrawn = from.withdraw(amount, now); // returns Result
    if (withdrawn.isErr()) return Err(withdrawn.unwrapErr());
    to.deposit(amount, now);
    return Ok(undefined);
  }
}
```

---

## DO / DO-NOT

**DO**
- Keep entities **always valid** — call `validate()` on construction and after each mutation.
- Put business logic **on** entities/aggregates (rich model).
- Inject `id`, `createdAt`, `updatedAt` (and any randomness) through `create()`.
- Return business-rule violations as `Err(DomainError)` via `Result`.
- Emit domain events with `addEvent()`; let the repository `publishEvents()` in-transaction.
- Compare entities by **id**, value objects by **value**.

**DO-NOT**
- ❌ `import` anything from `@nestjs/*`, an ORM/Slonik, `@anthropic-ai/sdk`, `fs`, or `fetch`.
- ❌ Call `Date.now()` / `crypto.randomUUID()` inside the domain.
- ❌ Add public setters or mutate props from outside the entity.
- ❌ Throw for business rules (return `Result`); ❌ swallow technical faults (let those throw).
- ❌ Build an anemic model whose logic lives in application services.
- ❌ Wrap every primitive in a VO, or add a domain service for single-entity logic (YAGNI).

## Required vs Optional (apply Output Scaling)

| Block | File | Priority | When to add |
| --- | --- | --- | --- |
| Entity (`Entity` base) | `*.entity.ts` | Required | Every module. |
| Domain Errors | `*.errors.ts` | Required | As soon as any rule can fail. |
| Entity props type | `*.types.ts` / inline | Required | With the entity. |
| AggregateRoot | `*.entity.ts` extends `AggregateRoot` | Optional | When the module emits events / is a write boundary. |
| Value Object | `*.value-object.ts` | Optional | A primitive has real validation/behaviour rules. |
| Domain Event | `*.domain-event.ts` | Optional | Decoupling or cross-context reactions are needed. |
| Domain Service | `*.domain-service.ts` | Experimental | Logic spans multiple aggregates and fits no entity. |

**Cross-references:** base classes & tree → `02-folder-structure.md`; `Guard`, `Result`, exception
hierarchy → `07-cross-cutting.md`; handlers, ports, and the Command→Event→Command rule →
`04-application-layer.md`; repositories, mappers, and in-transaction `publishEvents()` →
`05-infrastructure-layer.md`; controllers mapping domain errors to HTTP → `06-interface-layer.md`;
the AI Agent context's domain (`Agent`, `Conversation`, `Message`, `Tool`, `PromptTemplate`) →
`08-ai-agent-first.md`.

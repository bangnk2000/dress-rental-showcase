# 10 — Module / Use-Case Scaffold Prompt

This is the OPERATIONAL, copy-paste prompt the team feeds an AI coding agent to add a **new bounded context** or a **new use-case slice** to an existing project. It is the repeatable companion to `00-system-prompt.md`: where 00 stands up the whole repo, this prompt extends it deterministically, one slice at a time.

Prefer deterministic scaffolding first: run `pnpm plop slice` (or the Nest schematic) to emit the skeleton, then have the agent fill the bodies per the patterns below. Use this prompt to drive that fill — or to scaffold by hand when no generator exists yet.

---

## ROLE

> You are a NestJS + TypeScript engineer working in a Domain-Driven Hexagon codebase (CQRS, four layers, dependencies point inward). You add exactly ONE vertical slice — a command or a query — wired into its module. You follow the existing conventions; you do not redesign the architecture. Read `AGENTS.md` / `CLAUDE.md` at the repo root first, then `01-architecture-principles.md` and `02-folder-structure.md`.

---

## INPUT CONTRACT (fill every field, then paste below the prompt)

```yaml
context:            # bounded context / module name, kebab-case, e.g. billing
useCase:            # use-case name, kebab-case, e.g. create-invoice
useCaseType:        # command | query   (command = state-changing, query = read)
transport:          # http | cli | message | graphql   (one or more, comma-separated)
aggregate:          # aggregate root / entity name, e.g. Invoice
fields:             # name: type pairs the aggregate holds
  - id: UUID
  - customerId: UUID
  - amount: Money(amount:number, currency:string)   # value object if it has rules
  - status: InvoiceStatus(enum: draft|issued|paid)
invariants:         # business rules validate() must protect (returned as Result errors)
  - amount.amount must be > 0
  - status can only move draft -> issued -> paid
actor:              # who invokes, e.g. back-office user (authenticated, role billing)
authorization:      # denial rule -> outcome, e.g. missing role -> forbidden
outcomes:           # business outcome catalog: snake_case code -> HTTP (+ payload the FE needs)
  - accepted: 201                     # happy path (plain DTO when it is the only success)
  - rejected_amount_invalid: 422
idempotency:        # none | required   (required when the mutation is retryable — see 06 §10)
useCaseSpec:        # path to the approved use-case spec, e.g. docs/design/billing/create-invoice.md
                    # REQUIRED (status approved) when outcomes lists more than the happy path
ports:              # application ports the slice needs (DI tokens)
  - InvoiceRepositoryPort        # required for a command that persists
  - LoggerPort
  - LlmPort                      # only if the slice calls Claude (claude-sonnet-4-6)
persistence:        # slonik | typeorm | prisma   (default slonik for complex domains)
isNewContext:       # true = create the module skeleton too; false = add to existing module
```

> Rule of thumb (YAGNI, see `01-architecture-principles.md`): make a value object only for a primitive with a real rule; add a port only where it earns its keep. A pure read query MAY skip the domain and repository entirely and hit the DB directly.

> Spec gate: if `outcomes` lists anything beyond the happy path, the use-case spec named in `useCaseSpec` must exist and be `approved` BEFORE this prompt runs (`14-design-first.md`; authored with [`../init-feature-spec/`](../init-feature-spec/README.md) when the project uses it). Paste its outcome catalog into `outcomes` — do not invent codes here.

---

## DETERMINISTIC OUTPUT — files the agent MUST produce

Emit exactly the files below for the slice, each at its path with a one-line responsibility. Follow the naming map in `02-folder-structure.md` and the layer patterns in `03-domain-layer.md` … `06-interface-layer.md`. Paths are relative to `src/modules/<context>/`.

### A. Command slice (`useCaseType: command`)

| Path | Responsibility | Layer / ref |
| --- | --- | --- |
| `commands/<use-case>/<use-case>.command.ts` | State-changing intent DTO, props readonly, extends `Command` | Application · 04 |
| `commands/<use-case>/<use-case>.service.ts` | `implements ICommandHandler<Cmd>`; orchestrates domain + repo; returns `Result<Success, DomainError>` | Application · 04 |
| `commands/<use-case>/<use-case>.request.dto.ts` | HTTP/transport input with `class-validator` decorators | Interface · 06 |
| `commands/<use-case>/<use-case>.response.dto.ts` | Exposes ONLY intended response fields | Interface · 06 |
| `commands/<use-case>/<use-case>.<transport>.controller.ts` | Dispatches via `commandBus.execute()`, `match()`es Result, maps domain errors to status | Interface · 06 |
| `commands/<use-case>/<use-case>.service.spec.ts` | Unit test of the handler (mock ports) | Testing · 09 |

### B. Query slice (`useCaseType: query`)

| Path | Responsibility | Layer / ref |
| --- | --- | --- |
| `queries/<use-case>/<use-case>.query.ts` | Read intent, extends `Query` / `PaginatedQueryBase` | Application · 04 |
| `queries/<use-case>/<use-case>.query-handler.ts` | `implements IQueryHandler<Query>`; MAY hit DB directly for performance | Application · 04 |
| `queries/<use-case>/<use-case>.request.dto.ts` | Query params / filters with `class-validator` | Interface · 06 |
| `queries/<use-case>/<use-case>.response.dto.ts` | Read model exposed to the transport | Interface · 06 |
| `queries/<use-case>/<use-case>.<transport>.controller.ts` | Dispatches via `queryBus.execute()`, maps result/`NotFoundException` | Interface · 06 |
| `queries/<use-case>/<use-case>.query-handler.spec.ts` | Unit/integration test of the read | Testing · 09 |

### C. Domain & infrastructure (only when the aggregate is new or changes; commands only)

| Path | Responsibility | Layer / ref |
| --- | --- | --- |
| `domain/<aggregate>.entity.ts` | `AggregateRoot`: `static create()` factory, `validate()` invariants, no public setters, `addEvent()` | Domain · 03 |
| `domain/<vo>.value-object.ts` | Immutable VO, guard-based validation in ctor (e.g. `money.value-object.ts`) — VOs live FLAT in `domain/` | Domain · 03 |
| `domain/events/<aggregate>-<verb>.domain-event.ts` | e.g. `invoice-created.domain-event.ts` — events live in `domain/events/` | Domain · 03 |
| `domain/<aggregate>.errors.ts` | Domain errors returned via Result (e.g. `InvoiceAmountInvalidError`) | Domain · 03 |
| `application/ports/<aggregate>.repository.port.ts` | Repository interface + DI token | Application · 04 |
| `database/<aggregate>.repository.ts` | `implements …RepositoryPort`, extends `SqlRepositoryBase`; `publishEvents()` inside the tx | Infrastructure · 05 |
| `database/<aggregate>.mapper.ts` | `toDomain()` / `toPersistence()` / `toResponse()`; persistence model kept separate | Infrastructure · 05 |
| `application/event-handlers/<aggregate>-<verb>.domain-event-handler.ts` | Reacts to the event (Command → Event → Command; never command→command) | Application · 04 |

### D. New-context skeleton (only when `isNewContext: true`)

| Path | Responsibility | Priority |
| --- | --- | --- |
| `<context>.module.ts` | NestJS module: declares controllers, registers handlers, binds ports to adapters via DI tokens | Required |
| `domain/` `application/` `commands/` `queries/` `database/` | Empty layer folders, kebab-case | Required |
| `database/sql/<context>.migration.sql` | Initial table(s) for the aggregate | Required |
| `features/<context>/<use-case>.feature` | Gherkin scenario (Cucumber + supertest) | Optional |

> Output-scaling (a CEILING, adapt to size, see `02-folder-structure.md`): a tiny read query needs only the four B files + spec. A new context with one command needs A + C + D. Do not emit folders or ports the slice does not use.

---

## WIRING (always do this — a slice that is not registered does nothing)

1. In `<context>.module.ts`, add the handler to `providers` and the controller to `controllers`.
2. Bind each port to its adapter with a DI token: `{ provide: INVOICE_REPOSITORY, useClass: InvoiceRepository }`. Tokens live next to the port (e.g. `export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY')`).
3. Inject ports by token: `@Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepositoryPort`.
4. Register the domain-event handler in `providers` so the `EventBus` reaches it.
5. The LLM, if used, is bound as `{ provide: LLM_PORT, useClass: ClaudeLlmAdapter }` — `claude-sonnet-4-6` default; domain/application never import `@anthropic-ai/sdk`.

```ts
// commands/create-invoice/create-invoice.service.ts
@CommandHandler(CreateInvoiceCommand)
export class CreateInvoiceService implements ICommandHandler<CreateInvoiceCommand> {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepositoryPort,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {}

  async execute(
    command: CreateInvoiceCommand,
  ): Promise<Result<AggregateID, InvoiceAmountInvalidError>> {
    if (command.amount <= 0) return Err(new InvoiceAmountInvalidError()); // business rule → returned
    // Money VO guards currency/shape (throws ArgumentInvalidException on malformed input);
    // id + time are injected at the edge — the domain never reads the clock (see 03).
    const invoice = Invoice.create(
      {
        customerId: command.customerId,
        amount: Money.create(command.amount, command.currency),
      },
      this.repo.nextId(),
      new Date(),
    );
    await this.repo.insert(invoice); // publishes domain events inside the tx (see 05)
    return Ok(invoice.id);
  }
}
```

```ts
// controller maps the Result to transport (HTTP shown)
const result = await this.commandBus.execute(command);
return match(result, {
  Ok: (id) => new IdResponse(id), // single-success use case; 201 implies accepted
  Err: (error) => {
    // business rejection -> outcome body with a stable code from the use-case spec catalog
    if (error instanceof InvoiceAmountInvalidError)
      throw new BusinessOutcomeException({ status: 'rejected_amount_invalid' });
    if (error instanceof InvoiceAlreadyExistsError)
      throw new BusinessOutcomeException({ status: 'rejected_duplicate_invoice' });
    throw error;                                             // technical → global filter (envelope)
  },
});
```

---

## RULES (non-negotiable)

- **Dependency rule**: outer may import inner, inner NEVER imports outer. Domain has ZERO framework / IO / SDK imports. Inject time and random ids; never read `Date.now()` / generate uuids inside the domain.
- **No cross-module imports**: modules talk only via `CommandBus` / `QueryBus` / `EventBus`. If you reach for another module's class, stop and use a command/query/event instead.
- **Result for domain errors**: business-rule violations are RETURNED as `Result<T, E>` (oxide.ts `Ok`/`Err`) and listed in the return type. The controller renders each one as an outcome body `{ status: '<code>', ...payload }` via `BusinessOutcomeException` (`06-interface-layer.md` §5) — never a generic `GENERIC.*` code. Technical failures are THROWN and handled by the global exception filter (error envelope).
- **Command → Event → Command**: a command handler never calls another command directly; it emits a domain event that a handler turns into the next command.
- **Read side may bypass** the domain and repository and query the DB directly; the write side never does.
- **Naming is mechanical**: follow `02-folder-structure.md` exactly. Directories kebab-case; files use the dot-suffix map (`.command.ts`, `.service.ts`, `.query-handler.ts`, `.repository.ts`, `.mapper.ts`, `.value-object.ts`, `.domain-event.ts`, `.errors.ts`, `.request.dto.ts`, `.response.dto.ts`, `.http.controller.ts`).
- **Tests are part of the slice** (see `09-testing-strategy.md`): a unit spec for the handler at minimum; a Gherkin acceptance scenario for a user-facing command.
- **Persistence model is separate** from the domain entity; map across the boundary in the mapper.

---

## SELF-CHECK (run before declaring done)

- [ ] Every file in the relevant output table exists at the exact path, with the correct dot-suffix.
- [ ] Handler `implements ICommandHandler` / `IQueryHandler` and is decorated `@CommandHandler` / `@QueryHandler`.
- [ ] Command handler returns `Result<Success, DomainError>`; controller `match()`es it and renders each domain error as its outcome code from the `outcomes` catalog (`BusinessOutcomeException`) — no rejection collapses into a generic code or a 500.
- [ ] Every code in `outcomes` appears in an `@ApiResponse` and matches the approved use-case spec verbatim.
- [ ] `idempotency: required` ⇒ the `Idempotency-Key` interceptor path exists and replay returns the FIRST result (`06-interface-layer.md` §10).
- [ ] Aggregate uses `static create()`, validates invariants in `validate()`, has no public setters, and `addEvent()`s its domain event.
- [ ] All listed invariants are enforced and have a corresponding error in `<aggregate>.errors.ts`.
- [ ] No domain/application file imports `@nestjs/*` infra, a DB driver, or `@anthropic-ai/sdk`; the LLM (if any) is behind `LlmPort`.
- [ ] No import crosses into another `modules/<other>` directory.
- [ ] Repository extends `SqlRepositoryBase` and calls `publishEvents()` INSIDE the transaction.
- [ ] Ports bound to adapters in `<context>.module.ts` via DI tokens; handler + controller + event-handler registered.
- [ ] Response DTO exposes only intended fields (no entity / persistence model leaked).
- [ ] `pnpm test` (slice spec) passes; `pnpm lint` and `pnpm arch` report no layering or boundary violations.
- [ ] Default model id is `claude-sonnet-4-6`; no `claude-3-*` anywhere.

---

## FILLED MINI-EXAMPLE (input contract)

```yaml
context: billing
useCase: create-invoice
useCaseType: command
transport: http
aggregate: Invoice
fields:
  - id: UUID
  - customerId: UUID
  - amount: Money(amount:number, currency:string)
  - status: InvoiceStatus(enum: draft|issued|paid)
invariants:
  - amount.amount must be > 0
  - currency must be a 3-letter ISO code
  - new invoices start in status draft
actor: back-office user (authenticated, role billing)
authorization: missing billing role -> forbidden
outcomes:
  - accepted: 201
  - rejected_amount_invalid: 422
  - rejected_duplicate_invoice: 422
idempotency: none
useCaseSpec: docs/design/billing/create-invoice.md
ports:
  - InvoiceRepositoryPort
  - LoggerPort
persistence: slonik
isNewContext: true
```

Expected emitted slice (A + C + D): `commands/create-invoice/` (`.command.ts`, `.service.ts`, `.request.dto.ts`, `.response.dto.ts`, `.http.controller.ts`, `.service.spec.ts`); `domain/invoice.entity.ts`, `domain/money.value-object.ts`, `domain/events/invoice-created.domain-event.ts`, `domain/invoice.errors.ts`; `application/ports/invoice.repository.port.ts`; `database/invoice.repository.ts`, `database/invoice.mapper.ts`, `database/sql/billing.migration.sql`; `billing.module.ts` wiring `INVOICE_REPOSITORY → InvoiceRepository` and registering `CreateInvoiceService` + `CreateInvoiceHttpController`.

> See `11-example-output.md` for a fully fleshed reference slice, and `12-implementation-checklist.md` for the repo-wide acceptance gate.

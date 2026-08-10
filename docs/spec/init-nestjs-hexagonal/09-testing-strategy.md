# Testing Strategy

How to test a project built on this architecture. Tests are not an afterthought here: they are
**agent-verifiable guardrails**. A coding agent proves a vertical slice is correct by making the
pyramid green and CI's architecture checks pass (see `08-ai-agent-first.md`). This file says what
to test, where files live, the minimum skeleton per level, and — just as important — what NOT to
test.

The terminology assumed below (Entity, ValueObject, AggregateRoot, Command, `ICommandHandler`,
`IQueryHandler`, ports, `Result<T, E>`, domain errors) is defined in `03-domain-layer.md` and
`04-application-layer.md`. This file tests those building blocks; it does not redefine them.

> **Test runner.** NestJS 11's default is **Jest** (`@nestjs/testing` ^11, `jest`, `ts-jest` — or
> `@swc/jest` for a much faster compile). Integration uses **testcontainers**; acceptance uses
> **Cucumber + supertest**. Forward note: NestJS **12** (Q3 2026) makes **Vitest** the default
> runner — but the test *shape* below (pure-domain unit tests, mocked ports, testcontainers, Gherkin)
> is runner-agnostic and ports to Vitest with config changes only, not rewrites.

## The Pyramid (and how it maps to the layers)

| Level | Tests | Speed / Count | Dependencies | Lives | Priority |
| --- | --- | --- | --- | --- | --- |
| Unit | Domain (Entity, ValueObject, AggregateRoot, Domain Service) + handlers with mocked ports | Milliseconds, the most numerous | None real — pure functions + mocks | Colocated `*.spec.ts` | Required |
| Integration | Repositories, Mappers, Adapters (incl. `ClaudeLlmAdapter`) | Seconds, fewer | Real test DB / recorded LLM | `tests/integration/` | Required |
| Acceptance / e2e | Use cases end-to-end via HTTP, expressing ubiquitous language | Slow, fewest | Full app + test DB | `features/` + `tests/e2e/` | Required |

Output-Scaling note: the three levels are a CEILING. A small CRUD module may skip Cucumber and
cover its one use case with a single supertest e2e plus unit tests. A rich domain (the `ai-agent`
context, billing, anything with invariants) earns the full pyramid. Never delete the unit level —
it is the cheapest guardrail and the one agents lean on most.

## Where Test Files Live

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `modules/<context>/domain/**/*.spec.ts` | Unit tests for entities/VOs/aggregates | Pure logic, invariant + factory tests | Required |
| `modules/<context>/**/*.service.spec.ts` | Command-handler unit tests | Handler + mocked repository/llm ports | Required |
| `modules/<context>/**/*.query-handler.spec.ts` | Query-handler unit tests | Read model shape, mocked DB port | Optional |
| `tests/integration/<context>/` | Repos, mappers, adapters vs real DB | Testcontainers setup, round-trip persistence | Required |
| `tests/setup/` | Shared bootstrap | testcontainers helpers, Nest test module factories | Required |
| `tests/builders/` | Test data builders / object mothers | `UserBuilder`, `ConversationBuilder` | Required |
| `features/<context>/*.feature` | Gherkin acceptance specs | `Given/When/Then` in ubiquitous language | Optional |
| `features/step-definitions/` | Cucumber glue → supertest | World setup, step bindings | Optional |
| `tests/e2e/<context>/` | supertest HTTP e2e | Spin app, hit endpoints, assert status + body | Required |

Colocation rule (Common Closure, from `02-folder-structure.md`): unit tests change with the code
they cover, so they sit next to it. Integration/acceptance tests span modules and own
infrastructure, so they live under top-level `tests/` and `features/`.

## Unit: Domain (the heart of the pyramid)

Test invariants, factory `create()` results, equality, and every branch of business logic. Domain
has zero IO, so these tests need no mocks and no async. Time and random ids are **injected**
(`03-domain-layer.md`), so pass fixed values and assert deterministically.

A ValueObject test — guard-based validation returns a domain error via `Result`, never throws for
business-rule violations:

```ts
import { Email } from './email.value-object';
import { ArgumentInvalidException } from '@libs/exceptions';

describe('Email value object', () => {
  it('creates from a valid address', () => {
    const email = Email.create('ada@example.com');
    expect(email.unpack()).toBe('ada@example.com');
  });

  it('throws ArgumentInvalidException for a malformed address', () => {
    // A VO guards FORMAT and throws a technical exception on garbage input (03-domain-layer.md);
    // business-rule violations, by contrast, are RETURNED as Result domain errors.
    expect(() => Email.create('not-an-email')).toThrow(ArgumentInvalidException);
  });

  it('has structural equality', () => {
    const a = Email.create('ada@example.com');
    const b = Email.create('ada@example.com');
    expect(a.equals(b)).toBe(true);
  });
});
```

An AggregateRoot test asserts that a state-changing method enforces the invariant **and** records
the domain event (the event is published later by the repository, inside the transaction — see
`05-infrastructure-layer.md`):

```ts
it('emits UserCreated and protects the email invariant', () => {
  const user = UserBuilder.valid().build();
  const events = user.domainEvents.map((e) => e.constructor.name);
  expect(events).toContain('UserCreatedDomainEvent');
});
```

## Unit: Application Handlers (with mocked ports)

A handler orchestrates the domain and a repository and returns `Result<Success, DomainError>`
(`04-application-layer.md`). Test it by injecting a **mocked port** — never a real DB. Assert both
the happy path and each documented domain error. The `Command -> Event -> Command` rule means a
handler never invokes another command, so there is nothing cross-handler to mock.

```ts
import { Test } from '@nestjs/testing';
import { CreateUserService } from './create-user.service';
import { CreateUserCommand } from './create-user.command';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../application/ports/user.repository.port';
import { UserAlreadyExistsError } from '../../domain/user.errors';
import { UserBuilder } from '../../../../../tests/builders/user.builder';

describe('CreateUserService', () => {
  let service: CreateUserService;
  let repo: jest.Mocked<UserRepositoryPort>;

  beforeEach(async () => {
    repo = {
      insert: jest.fn(),
      findOneByEmail: jest.fn(),
      nextId: jest.fn().mockReturnValue('fixed-uuid-0001'),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateUserService,
        { provide: USER_REPOSITORY, useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(CreateUserService);
  });

  it('persists a new user and returns Ok(id)', async () => {
    repo.findOneByEmail.mockResolvedValue(null);
    repo.insert.mockResolvedValue(undefined); // insert returns Promise<void>, not a Result

    const result = await service.execute(
      new CreateUserCommand({ email: 'ada@example.com', country: 'US', postalCode: '94016', street: '1 Market St' }),
    );

    expect(result.isOk()).toBe(true);
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });

  it('returns UserAlreadyExistsError when the email is taken', async () => {
    repo.findOneByEmail.mockResolvedValue(UserBuilder.valid().build());

    const result = await service.execute(
      new CreateUserCommand({ email: 'ada@example.com', country: 'US', postalCode: '94016', street: '1 Market St' }),
    );

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(UserAlreadyExistsError);
    expect(repo.insert).not.toHaveBeenCalled();
  });
});
```

For the `ai-agent` context, mock `LlmPort` the same way — return canned completions/tool-calls.
The handler must never see `@anthropic-ai/sdk`; that lives only in `ClaudeLlmAdapter`
(`05-infrastructure-layer.md`, `08-ai-agent-first.md`), which is covered at the integration level.

## Test Data Builders & Fixtures

Do not hand-build aggregates inline in every test — it is noisy and breaks on every constructor
change. Use builders (object mothers) under `tests/builders/`. A builder produces a **valid**
aggregate by default and exposes `with*` overrides:

```ts
// tests/builders/user.builder.ts
export class UserBuilder {
  private email = 'ada@example.com';
  private address = new Address({ country: 'US', postalCode: '94016', street: '1 Market St' });

  static valid(): UserBuilder {
    return new UserBuilder();
  }

  withEmail(email: string): this {
    this.email = email;
    return this;
  }

  build(): UserEntity {
    // The SAME 3-arg create() production code uses — (props, id, now); see 03-domain-layer.md.
    return UserEntity.create(
      { email: Email.create(this.email), address: this.address },
      'fixed-uuid-0001',
      new Date('2026-01-01T00:00:00Z'),
    );
  }
}
```

Builders centralize the "valid object" definition so the domain's shape lives in one place — a big
win for agents generating new tests. Inject the same fixed `id`/`now` the domain expects so unit
tests stay deterministic.

## Integration: Repositories, Mappers, Adapters

Test the seams the unit level mocks away: that a Mapper's `toDomain()`/`toPersistence()` round-trip
is lossless, that a repository implementing `*.repository.port.ts` and extending
`SqlRepositoryBase` (`libs/db`) actually reads/writes, and that aggregate events publish **inside**
the DB transaction. Run against a real Postgres via **testcontainers** — never mock SQL.

```ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

describe('UserRepository (integration)', () => {
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let repo: UserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    repo = await makeUserRepository(container.getConnectionUri()); // Slonik pool / ORM
  }, 60_000);

  afterAll(() => container.stop());

  it('persists and reloads an aggregate by id', async () => {
    const user = UserBuilder.valid().build();
    await repo.insert(user);

    const found = await repo.findOneById(user.id);
    expect(found?.equals(user)).toBe(true);
  });
});
```

For the LLM adapter, integration-test `ClaudeLlmAdapter` against recorded/replayed fixtures (or a
contract test) so CI is deterministic and offline — assert it maps the SDK response onto the
`LlmPort` shape and defaults to `claude-sonnet-4-6`. Keep live-API calls out of the main suite;
gate them behind an opt-in flag.

### Invariant proof tests (Required)

Every **DB-enforced invariant** in the design doc's enforcement table (`14-design-first.md` §3.1)
gets a test that **provokes the constraint** and asserts the mapped outcome — the duplicate
insert, the overlapping range, the double registration. This is the only test that proves the
system's strongest promise; a migration adding a constraint that no test provokes is an unproven
claim.

```ts
it('rejects an overlapping booking with the same domain error the pre-check produces', async () => {
  await repo.insert(bookingFor('dress-1', '2026-08-01', '2026-08-05'));
  // Bypass the handler pre-check on purpose: this exercises the CONSTRAINT path.
  await expect(
    repo.insert(bookingFor('dress-1', '2026-08-03', '2026-08-07')),
  ).rejects.toThrow(OverlappingBookingError); // exclusion violation → mapped domain error
});
```

The constraint path must map to the SAME domain error / outcome the pre-check produces (e.g.
the handler returns `Err(DuplicateRegistrationError)` → the controller renders
`{ status: 'rejected_duplicate_registration' }`, 422) — never a bare SQL error or generic 500.

When the invariant is race-sensitive, the sequential version above is not enough — fire the two
writes **concurrently** (`Promise.allSettled` of two inserts) and assert exactly one wins. And
these tests MUST run against real Postgres **in CI** (testcontainers locally, a `postgres:16`
service container in the workflow): a pipeline whose tests never touch the database proves
nothing about the invariants the design doc promises, no matter how green it is.

## Acceptance / e2e: Gherkin + supertest

Acceptance tests express **use cases in ubiquitous language** so domain experts can read them. Each
`.feature` maps to a vertical slice and is driven through the HTTP controller (`*.http.controller.ts`),
asserting the same outcome/status mapping the controller applies (`body.status` for business
outcomes, `body.error.code` for faults).

```gherkin
# features/user/create-user.feature
Feature: Registering a user
  As an operator
  I want to register a user by email
  So that they can access the system

  Scenario: A brand-new email is accepted
    When I register the email "ada@example.com"
    Then the response status is 201
    And the user is retrievable by that email

  Scenario: A duplicate email is rejected
    Given a user already exists with email "ada@example.com"
    When I register the email "ada@example.com"
    Then the response status is 422
    And the response body "status" is "rejected_email_taken"
```

Step definitions are thin glue over supertest against the booted Nest app:

```ts
When('I register the email {string}', async function (email: string) {
  this.response = await request(this.app.getHttpServer())
    .post('/v1/users')
    .send({ email });
});

Then('the response status is {int}', function (status: number) {
  expect(this.response.status).toBe(status);
});
```

Smaller modules may skip Cucumber and write the same assertions directly as supertest specs under
`tests/e2e/<context>/`. The outcome/status mapping comes from the outcome catalog in
`06-interface-layer.md` §5; e2e asserts `body.status` (outcomes) and `body.error.code` (faults),
not bare HTTP status — e2e is where you prove that mapping holds end-to-end.

Until real provider contract tests exist (e.g. consumer-driven pacts with the FE), the
committed-OpenAPI drift gate (`pnpm openapi:check`, `14-design-first.md` §4) is the named
type-level provider-contract evidence that release readiness (`init-release`) cites.

## Mocking Ports via DI

Always substitute a port through Nest's testing module using its DI token, not by reaching into the
class. Each port from `04-application-layer.md` (`repository.port.ts`, `logger.port.ts`,
`llm.port.ts`) has a token; `useValue` a `jest.Mocked<Port>` at the unit level and a real
implementation at the integration level. This keeps the layer boundary honest: if a test has to mock
something the layer should not know about, the design — not the test — is wrong.

## Coverage Targets (per layer)

| Layer | Target | Rationale |
| --- | --- | --- |
| Domain (entities, VOs, aggregates, domain services) | 95–100% lines + branches | Pure, cheap, highest value; invariants must be fully exercised |
| Application (handlers) | ~90%; every documented `Result` error path | Each domain error in a return type needs a test |
| Infrastructure (repos, mappers, adapters) | Critical paths via integration, not % | Round-trips and tx behavior matter more than line count |
| Interface (controllers, DTOs) | Covered by e2e/acceptance, not unit | Thin dispatch + mapping; test through HTTP |

Enforce minimums in CI via Jest's `coverageThreshold`. Treat the domain threshold as a hard gate —
it is the layer an agent is most likely to under-test.

## What NOT to Test

- **Framework / library internals.** Don't test that NestJS injects, that `class-validator`
  validates, or that Slonik/TypeORM run SQL — trust the dependency.
- **Getters / trivial mappers** with no logic. Their behavior is asserted transitively by the
  round-trip integration test.
- **The read side through the domain.** Query handlers may bypass the repository and hit the DB
  directly (`04-application-layer.md`); test the returned read-model shape, not domain invariants.
- **Private methods directly.** Test them through the public method/factory that uses them.
- **Mocked-mock tautologies.** Asserting only that a mock was called, with no real behavior under
  test, proves nothing.
- **Thrown technical exceptions as if they were domain errors.** Technical failures are thrown and
  handled by the global exception filter; assert the filter's response in e2e, not in unit tests.

## Tests as Agent-Verifiable Guardrails

These tests close the loop for an autonomous agent (`08-ai-agent-first.md`):

- The scaffolder (`10-module-scaffold-prompt.md`) emits a slice **with** its `*.spec.ts`, builder,
  and `.feature` stubs, so a generated slice is born testable.
- A green pyramid plus passing **architecture** checks (dependency-cruiser forbidding inner→outer
  and cross-module imports, eslint boundaries, naming lint — all in `08-ai-agent-first.md` CI) is
  the machine-checkable definition of "done" the agent optimizes against.
- Coverage thresholds and the "every documented `Result` error path is tested" rule give the agent
  an unambiguous target it cannot satisfy by writing shallow tests.

The exact commands to run all of the above (`test:unit`, `test:integration`, `test:e2e`,
`test:cov`) are listed in the root `AGENTS.md` / `CLAUDE.md` per `08-ai-agent-first.md`.

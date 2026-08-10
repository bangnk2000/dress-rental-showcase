# 06 — Interface Adapters (Delivery) Layer

The **outermost ring**. Interface adapters translate the outside world (HTTP, CLI, message
brokers, GraphQL) into application intent and back. They depend INWARD on the Application layer
(`CommandBus` / `QueryBus`) and NEVER on Domain internals or Infrastructure SDKs. A controller's
only jobs: parse + validate input, build a Command/Query, dispatch it, and map the returned
`Result<T, E>` (or a thrown exception) to a transport-specific response.

See `04-application-layer.md` for the commands/queries they dispatch, `05-infrastructure-layer.md`
for the mappers' `toResponse()`, and `07-cross-cutting.md` for the global exception filter that
catches everything a controller does not (and should not) handle by hand.

> **Output-Scaling note.** This file is the CEILING. A small service may ship only an HTTP
> controller per slice and skip CLI/message/GraphQL transports and versioning until a real second
> consumer exists. Idempotency keys are NOT in that bucket: the moment the use-case spec marks a
> mutation as retryable (`14-design-first.md` §2, "The use-case specification"), the `Idempotency-Key` support in §10 is
> Required — a retry story is an acceptance criterion, not speculation.

> **NestJS 11 / Express 5.** This set targets NestJS 11, whose default HTTP adapter is **Express 5**.
> Two consequences for controllers: (1) **wildcard routes must be named** — write
> `@Get('files/*splat')`, not `@Get('files/*')` (a bare `*` no longer matches); (2) `req.query` is a
> read-only getter and the default parser no longer does `qs` deep parsing, so put nested
> filters/pagination in a validated Query DTO (or set `app.set('query parser', 'extended')` in
> `main.ts`). Swap to `@nestjs/platform-fastify` only if you need its throughput.

## 1. Where interface adapters live: inside the use-case slice

Controllers are **not** collected in a top-level `controllers/` folder. They live next to the
command/query they trigger (vertical slicing + Common Closure — files that change together live
together). Adding a field to "create user" should touch one directory, not five.

```
modules/<context>/
├── commands/
│   └── create-user/
│       ├── create-user.command.ts
│       ├── create-user.service.ts          # ICommandHandler<CreateUserCommand>
│       ├── create-user.http.controller.ts  # ◄ interface adapter (this layer)
│       ├── create-user.cli.controller.ts   # ◄ optional transport
│       ├── create-user.message.controller.ts
│       ├── create-user.request.dto.ts      # ◄ class-validator input
│       └── create-user.response.dto.ts     # ◄ output shape
└── queries/
    └── find-users/
        ├── find-users.query.ts
        ├── find-users.query-handler.ts     # IQueryHandler<FindUsersQuery>
        ├── find-users.http.controller.ts
        └── find-users.response.dto.ts
```

| File | Purpose | Priority |
| --- | --- | --- |
| `*.http.controller.ts` | REST/HTTP delivery for one use case | Required |
| `*.request.dto.ts` | Input contract, validated by class-validator | Required |
| `*.response.dto.ts` | Output contract, exposes ONLY intended fields | Required |
| `*.cli.controller.ts` | CLI delivery (nest-commander) for the same use case | Optional |
| `*.message.controller.ts` | Broker/event delivery (`@MessagePattern`/`@EventPattern`) | Optional |
| `*.graphql-resolver.ts` | GraphQL delivery (`@Resolver`/`@Mutation`/`@Query`) | Optional |

**Why one controller per transport, per slice?** Each transport has different input shapes, auth,
and error mapping (HTTP status vs. broker ack/nack vs. CLI exit code). Keeping them as separate
thin files — all dispatching the SAME command — avoids a god-controller and keeps each adapter's
concerns isolated. The command/handler stays transport-agnostic.

## 2. Request DTO — the input contract

Request DTOs use `class-validator` + `class-transformer`. They validate **shape and primitive
rules** at the edge (fail-fast, technical) so the domain receives plausible data. They do NOT
enforce business invariants — that is the entity's `validate()` (see `03-domain-layer.md`).

```ts
// create-user.request.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class CreateUserRequestDto {
  @ApiProperty({ example: 'jane@acme.io' })
  @IsEmail()
  readonly email!: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @Length(2, 2)
  readonly country!: string;

  @ApiProperty({ example: '94016' })
  @IsString()
  @Length(1, 16)
  readonly postalCode!: string;

  @ApiProperty({ example: '1 Market St' })
  @IsString()
  @Length(1, 120)
  readonly street!: string;
}
```

Enable a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
in `main.ts` so unknown fields are stripped/rejected and payloads are transformed to DTO
instances. Validation failures throw — the exception filter (`07-cross-cutting.md`) maps them to
`400 Bad Request`.

## 3. Response DTO — expose ONLY intended fields

The persistence model and domain entity are NEVER serialized directly. A Response DTO is the
public contract; the **mapper's `toResponse()`** (defined in `05-infrastructure-layer.md`) converts
a domain object into it, guaranteeing internal fields (password hashes, domain events, version
columns) never leak.

```ts
// create-user.response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '6f1e2c3a-...' })
  readonly id!: string;

  @ApiProperty({ example: 'jane@acme.io' })
  readonly email!: string;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z' })
  readonly createdAt!: string;
}
```

Rule of thumb: a new field is exposed only when a Response DTO **and** `toResponse()` are
updated to include it. Default to hiding.

## 4. HTTP controller — dispatch + Result.match()

The controller builds a Command, calls `commandBus.execute()`, and `match()`es the returned
`Result`. A business rejection is **returned** by the handler and rendered as an **outcome
response** — `{ "status": "<outcome_code>", ...payload }` via `BusinessOutcomeException`
(`07-cross-cutting.md`) — with a stable snake_case code from the use case's outcome catalog (§5).
Technical failures are thrown by the handler and caught by the global filter — the controller
does not catch them.

```ts
// create-user.http.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { match, Result } from 'oxide.ts';
import { BusinessOutcomeException } from '@libs/exceptions';
import { IdResponse } from '@libs/ddd';
import { CreateUserCommand } from './create-user.command';
import { CreateUserRequestDto } from './create-user.request.dto';
import { UserAlreadyExistsError } from '../../domain/user.errors';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class CreateUserHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiResponse({ status: 201, description: 'Created', type: IdResponse })
  @ApiResponse({ status: 422, description: "Outcome body { status: 'rejected_email_taken' }" })
  async create(@Body() body: CreateUserRequestDto): Promise<IdResponse> {
    const command = new CreateUserCommand({
      email: body.email,
      country: body.country,
      postalCode: body.postalCode,
      street: body.street,
    });

    // The handler returns the new identity only (see 04-application-layer.md).
    const result: Result<string, UserAlreadyExistsError> =
      await this.commandBus.execute(command);

    return match(result, {
      Ok: (id: string) => new IdResponse(id), // 201; single-success use case, so no status field
      Err: (error: Error) => {
        if (error instanceof UserAlreadyExistsError) {
          // business rejection -> outcome response, NOT a generic HTTP error
          throw new BusinessOutcomeException({ status: 'rejected_email_taken' });
        }
        throw error; // unexpected: the global filter renders GENERIC.INTERNAL
      },
    });
  }
}
```

> The `match()` Err branch is the seam between the two error styles described in
> `01-architecture-principles.md`: a **returned** `DomainError` is a business outcome and becomes
> a `BusinessOutcomeException` with a stable outcome code; only **technical** faults use the
> `libs/exceptions` envelope types. The global filter (`07-cross-cutting.md`) renders both
> shapes. Controllers translate; the filter formats.

Response-richness rule: when the FE needs data to act on an outcome (remaining stock, the new
price, the locked value), put it **in** the outcome/response body — never force a follow-up GET
to learn why a command was rejected. A use case with a single success outcome may return a plain
DTO (201 implies accepted); a use case with several success outcomes returns
`{ status, ...payload }` on success too.

## 5. Outcome catalog — domain error → `status` code → HTTP

Each use case documents its outcomes in its use-case spec (`14-design-first.md`; authored with
the `init-feature-spec` set when the project uses it). Outcome codes are snake_case Ubiquitous
Language, stable once approved — the FE branches on them, so renaming one is a breaking change.

| Returned `Result` Err (domain) | Rendered as | HTTP | Payload the FE needs |
| --- | --- | --- | --- |
| `UserAlreadyExistsError` | `{ status: 'rejected_email_taken' }` | 422 | — |
| `InsufficientStockError` | `{ status: 'rejected_out_of_stock', availableStock }` | 422 | current stock |
| `EmailNotVerifiedError` | `{ status: 'rejected_email_not_verified' }` | 422 | — |
| `InsufficientPermissionError` | `{ status: 'forbidden', reason }` | 403 | reason code |
| (auth missing/invalid token) | envelope `GENERIC.UNAUTHORIZED` | 401 | — |
| validation (ValidationPipe) | envelope `GENERIC.VALIDATION` + `details[]` | 400 | field errors |
| unknown / technical (thrown) | envelope `GENERIC.INTERNAL` | 500 | — |

**403 arbitration — one rule, no third option.** A denial produced by a guard BEFORE the use case
runs (missing/invalid/expired token, route-guard role check) is transport-level: envelope
`GENERIC.UNAUTHORIZED` (401) or `GENERIC.FORBIDDEN` (403). A denial that is a NAMED outcome in the
use-case spec (locked account, not-owner, quota exceeded) is a business outcome: the handler
returns it as a `Result` Err and the controller renders `{ status: 'forbidden', reason }` (403)
via `BusinessOutcomeException`.

Keep the mapping explicit in the controller's `match()` — never let a business rejection collapse
into a generic `GENERIC.CONFLICT` (two different outcomes behind one code means the FE cannot
render the right state), and never let one become a 500. A 500 means a bug or a true
infrastructure failure, not a business rule.

## 6. Query controllers (read side)

Query controllers dispatch via `queryBus.execute()`. The read side may bypass domain and
repository and hit the DB directly (`04-application-layer.md`), but what it returns is a **read
model with explicitly selected columns** — the persistence model and `SELECT *` never cross the
boundary (that is how internal columns leak into the API). Pagination, filtering, and sorting
belong in the Query DTO, validated like any request DTO.

```ts
// find-users.http.controller.ts (excerpt)
@Get()
@ApiOperation({ summary: 'List users (paginated)' })
async find(@Query() query: FindUsersRequestDto): Promise<Paginated<UserResponseDto>> {
  const result = await this.queryBus.execute(new FindUsersQuery(query));
  return result.unwrap(); // Paginated<UserListItemDto> — explicit columns, response-shaped (04)
}
```

Unwrap the `Result` — returning it raw serializes the wrapper. The handler's read-model DTO
(read side — `04-application-layer.md`) is the response shape by construction; if the API needs a
different shape, map here, not in the handler.

## 7. CLI, message, and GraphQL transports

All three are thin adapters that build the SAME command/query and dispatch via the bus.

- **CLI** (`*.cli.controller.ts`, nest-commander): parse args/options into a Command; map the
  `Result` to a process exit code (0 = Ok, non-zero = Err) and stderr message.
- **Message** (`*.message.controller.ts`, `@MessagePattern`/`@EventPattern`): validate the
  payload, dispatch, then `ack`/`nack`. Recoverable domain errors → `ack` + dead-letter; technical
  failures → `nack` for redelivery.
- **GraphQL** (`*.graphql-resolver.ts`): `@Mutation`/`@Query` resolvers using input types as DTOs;
  map domain errors to typed GraphQL errors (extensions code mirrors the table in §5).

## 8. Versioning

Use NestJS URI versioning (`app.enableVersioning({ type: VersioningType.URI })`) and pin each
controller with `@Controller({ path: 'users', version: '1' })`. A breaking change to a Request or
Response DTO means a new `v2` controller in a sibling slice (or the same slice with a `version: '2'`
controller) — never a silent mutation of `v1`. Old versions stay until deprecation is communicated.

## 9. OpenAPI / Swagger

Annotate DTOs (`@ApiProperty`) and controllers (`@ApiTags`, `@ApiOperation`, `@ApiResponse`).
Document EVERY status from the §5 table with `@ApiResponse` so the spec lists every outcome
status (422/403 with their `status` codes) and error status (400/401/500), not just the happy
path. Build the document with `SwaggerModule` in `main.ts`; serve at `/docs` in
non-prod (gate behind config — see `07-cross-cutting.md`). The generated spec is the contract
consumers and AI agents read, so keep it accurate.

## 10. Idempotency & correlation id pass-through

- **Correlation id.** A middleware/interceptor reads `x-request-id` (or generates a uuid),
  stores it in a request-scoped context, and the `LoggerPort` (`libs/ports`) stamps every log line
  with it. Controllers do not read it manually; it flows through to commands, handlers, the DB
  transaction, and the `ClaudeLlmAdapter` so one request is traceable end to end. Echo it back in
  the response header.
- **Idempotency.** For unsafe POSTs the use-case spec marks retryable, accept an
  `Idempotency-Key` header. An interceptor (or the command handler) checks a short-lived store: a
  repeated key returns the FIRST result — same status and body, **including rejected outcomes** —
  with an `Idempotency-Replayed: true` header, and never re-executes the flow. This belongs at
  the edge so the domain stays pure and retry-agnostic. The FE resends the SAME key on retry and
  generates a NEW key only for a genuinely new attempt (e.g. "place order at the new price").

## 11. Do / Don't

- **Do** keep controllers thin: validate → build command/query → dispatch → `match()` → map. No
  business logic, no repository calls, no SDK imports.
- **Do** return Response DTOs produced by `mapper.toResponse()`; never serialize entities or
  persistence models.
- **Do** map every documented domain error to an explicit status; reserve 500 for true failures.
- **Don't** import another module's controllers, services, or domain — modules talk only via the
  command/query bus or events (`01-architecture-principles.md`). dependency-cruiser enforces this.
- **Don't** catch technical exceptions in the controller; let the global filter
  (`07-cross-cutting.md`) handle them uniformly.
- **Don't** put `@Injectable()` infra (repositories, adapters) into a controller constructor —
  inject only `CommandBus` / `QueryBus`.

When scaffolding a new use case, the controller + request DTO + response DTO are generated
together with the command/handler by the plop/Nest schematic (`10-module-scaffold-prompt.md`), so
every slice ships a consistent, correct delivery adapter.

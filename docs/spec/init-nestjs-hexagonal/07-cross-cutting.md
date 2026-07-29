# 07 — Cross-Cutting Concerns & Shared Kernel (libs/)

Spec for everything that does not belong to a single bounded context: configuration, logging,
the exception hierarchy + global filter, the `Result`/`Option` boundary rule, guard utilities,
observability, and security. These live in `libs/` (the shared kernel) or in root bootstrap
(`src/main.ts`, `src/app.module.ts`), and are wired into every module.

Output-Scaling note: this file is a CEILING. A small service needs only typed config, a logger
port, the exception hierarchy + filter, `Result`, and `guard.ts`. Everything marked **Prod-only**
(OpenTelemetry, metrics, full `/health`) is deferred until the project actually ships. Do not
scaffold observability infrastructure for a prototype.

Cross-refs: repository/adapter wiring is in `05-infrastructure-layer.md`; controllers consuming
the exception filter and `Result.match()` are in `06-interface-layer.md`.

> **Target runtime.** NestJS **11** (Express 5 is the default HTTP adapter) on **Node 22 LTS**
> (Node ≥ 20 required — v16/v18 are dropped), TypeScript 5.7+. Satellite majors: `@nestjs/config`
> **^4**, `@nestjs/cqrs` **^11**, `@nestjs/event-emitter` **^3**, `@nestjs/swagger` **^11**. The full
> pinned dependency list lives in `12-implementation-checklist.md`. NestJS **12** (roadmapped Q3 2026:
> ESM, Standard Schema validation, Vitest, oxlint, Rspack) is forward-compatible with this layout —
> nothing here hard-codes a build tool or module system, so a v12 migration is additive.

## Shared Kernel Layout (libs/)

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `libs/ddd/` | DDD base classes | `entity.base.ts`, `aggregate-root.base.ts`, `value-object.base.ts`, `repository.port.ts`, `mapper.interface.ts`, `domain-event.base.ts`, `command.base.ts`, `query.base.ts` | Required |
| `libs/db/` | Persistence base | `sql-repository.base.ts` (Slonik transaction + `publishEvents()`) | Required |
| `libs/ports/` | Generic ports | `logger.port.ts` | Required |
| `libs/exceptions/` | Exception hierarchy | `exception.base.ts`, `argument-invalid.exception.ts`, `not-found.exception.ts`, `conflict.exception.ts` | Required |
| `libs/guard.ts` | Invariant guards | `Guard.isEmpty`, `Guard.lengthIsBetween` | Required |
| `libs/utils/` | Pure helpers | id generation, date helpers (injected into domain, never read there) | Required |
| `libs/decorators/` | Shared decorators | param decorators, validation helpers | Optional |
| `libs/config/` | Typed config | `config.schema.ts`, `app-config.service.ts` | Required |
| `libs/observability/` | Tracing/metrics | OTel setup, metrics registry, health indicators | Prod-only |

Rule: `libs/` may be imported by any module; `libs/` itself imports nothing from `modules/`.
`libs/ddd/` and `libs/exceptions/` stay framework-free where possible so the domain can use them.

## Configuration — Required

`@nestjs/config` loads env; a **zod** (or joi) schema validates it at boot so a misconfigured
process fails fast instead of erroring deep in a request. Expose config only through a typed
service; never call `process.env` outside `libs/config/`.

```ts
// libs/config/config.schema.ts
import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
});

export type AppConfig = z.infer<typeof configSchema>;

export function validateConfig(raw: Record<string, unknown>): AppConfig {
  // Thrown (technical failure) — boot must abort on bad config.
  return configSchema.parse(raw);
}
```

```ts
// src/app.module.ts (excerpt)
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from 'libs/config/config.schema';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateConfig })],
})
export class AppModule {}
```

`.env.example` — Required. Lists every key from the schema with NO real values; the default app
model is `claude-sonnet-4-6` (see `08-ai-agent-first.md` for the LLM adapter). Secrets are never
committed; in prod they come from the platform secret store, not `.env`.

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://user:pass@localhost:5432/app
LOG_LEVEL=info
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
```

## Logging — LoggerPort + pino adapter — Required

The application and domain code depend on `LoggerPort` (a DI token), never on a concrete logger.
The adapter is **pino**, wired in infrastructure (see `05-infrastructure-layer.md` for adapter
registration patterns). This keeps logging swappable and keeps the framework out of inner layers.

```ts
// libs/ports/logger.port.ts
export interface LoggerPort {
  log(message: string, ...meta: unknown[]): void;
  error(message: string, trace?: unknown, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  debug(message: string, ...meta: unknown[]): void;
  setContext(context: string): void;
}

export const LOGGER_PORT = Symbol('LoggerPort');
```

Request-scoped context / correlation id — Required. A middleware reads or generates an
`x-request-id`, stores it in `AsyncLocalStorage`, and the pino adapter injects it into every line
so all logs for one request share a `requestId`. The same id is returned in the response header
and propagated to the LLM adapter and downstream calls.

```ts
// libs/observability/request-context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext { requestId: string }
export const requestContext = new AsyncLocalStorage<RequestContext>();
```

Logs are structured JSON (one object per line), with sensitive fields redacted via pino
`redact` paths (e.g. `req.headers.authorization`, `*.password`, `*.apiKey`).

## Exception Hierarchy — Required

Technical/unexpected failures are **thrown** as typed exceptions extending `ExceptionBase`.
Business rule violations are NOT thrown — they are returned as `Result<T, DomainError>` (see the
boundary rule below). Every exception carries a stable `code` so the filter can map it and clients
can branch on it.

```ts
// libs/exceptions/exception.base.ts
export interface SerializedException {
  message: string;
  code: string;
  correlationId?: string;
}

export abstract class ExceptionBase extends Error {
  abstract code: string;
  constructor(readonly message: string, readonly cause?: Error, readonly metadata?: unknown) {
    super(message);
  }
  toJSON(): SerializedException {
    return { message: this.message, code: this.code };
  }
}
```

```ts
// libs/exceptions/argument-invalid.exception.ts
export class ArgumentInvalidException extends ExceptionBase {
  readonly code = 'GENERIC.ARGUMENT_INVALID';
}
// libs/exceptions/not-found.exception.ts
export class NotFoundException extends ExceptionBase {
  readonly code = 'GENERIC.NOT_FOUND';
}
// libs/exceptions/conflict.exception.ts
export class ConflictException extends ExceptionBase {
  readonly code = 'GENERIC.CONFLICT';
}
```

| Exception | Thrown when | Maps to HTTP |
| --- | --- | --- |
| `ArgumentInvalidException` | guard/value-object construction fails on bad input | 400 |
| `NotFoundException` | repository cannot load a required aggregate by id | 404 |
| `ConflictException` | DB uniqueness/consistency violation surfaces technically | 409 |
| (uncaught / unknown) | bug, infra outage, unhandled throw | 500 |

## Global Exception Filter — Required

A single `@Catch()` filter at the root maps thrown exceptions to HTTP responses, attaches the
correlation id, logs at the right level (500s as `error`, 4xx as `warn`), and hides internals on
500. It does NOT handle domain errors — those never reach it, because controllers `match()` the
`Result` and convert domain errors to status codes themselves (see `06-interface-layer.md`).

```ts
// libs/exceptions/exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ExceptionBase } from './exception.base';
import { NotFoundException } from './not-found.exception';
import { ConflictException } from './conflict.exception';
import { ArgumentInvalidException } from './argument-invalid.exception';
import { requestContext } from 'libs/observability/request-context';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    const correlationId = requestContext.getStore()?.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof ArgumentInvalidException) status = HttpStatus.BAD_REQUEST;
    else if (exception instanceof NotFoundException) status = HttpStatus.NOT_FOUND;
    else if (exception instanceof ConflictException) status = HttpStatus.CONFLICT;

    const body =
      exception instanceof ExceptionBase
        ? { ...exception.toJSON(), correlationId }
        : { message: 'Internal server error', code: 'GENERIC.INTERNAL', correlationId };

    res.status(status).json(body);
  }
}
```

Register globally in `src/main.ts` with `app.useGlobalFilters(new GlobalExceptionFilter())`.

## Result / Option Boundary Rule — Required

Use `oxide.ts` (`Ok`, `Err`, `Result<T, E>`, `Some`/`None`, `Option<T>`); `@badrap/result` is the
acceptable alternative. The rule that keeps error handling explicit:

| Failure kind | Mechanism | Where | Example |
| --- | --- | --- | --- |
| Business / domain rule | **return** `Result<T, DomainError>` | domain + application | `UserAlreadyExistsError` |
| Absent-but-valid value | **return** `Option<T>` | domain + read models | optional middle name |
| Technical / unexpected | **throw** `ExceptionBase` | infrastructure + bootstrap | DB connection lost |

- Command handlers return `Result<Success, DomainError>`; controllers `match()` it (see
  `04-application-layer.md` and `06-interface-layer.md`).
- Domain errors extend a `DomainError` base and live in `*.errors.ts` per context; they are
  documented in the handler's return type, so callers cannot ignore them.
- Never throw a domain error to signal a recoverable business outcome, and never return a `Result`
  to paper over an infrastructure outage — let it throw and fail fast.

## Guard Utilities (guard.ts) — Required

Small, dependency-free helpers used inside value-object/entity constructors and `validate()` to
protect invariants. A failed guard throws `ArgumentInvalidException` (bad input is technical at the
construction boundary); higher-level business rules are returned as `Result`.

```ts
// libs/guard.ts
export class Guard {
  static isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }
  static lengthIsBetween(value: string, min: number, max: number): boolean {
    const n = value.trim().length;
    return n >= min && n <= max;
  }
}
```

## Observability — Prod-only

Deferred until the service ships; do not scaffold for prototypes. All of it builds on the
correlation id and `LoggerPort` already established above.

| Concern | What | Notes | Priority |
| --- | --- | --- | --- |
| Structured logging | JSON logs with `requestId`, level, context | already Required via pino; this just ships them to a collector | Required base / Prod sink |
| Tracing | OpenTelemetry SDK auto-instruments HTTP + DB + the LLM adapter | spans carry the same correlation id | Prod-only |
| Metrics | counters/histograms (request rate, latency, LLM tokens, error rate) | exposed at `/metrics` (Prometheus) | Prod-only |
| Health | `/health/liveness` (process up) + `/health/readiness` (DB + critical deps reachable) | use `@nestjs/terminus`; readiness gates traffic | Prod-only |

Liveness must NOT check downstream deps (so a transient DB blip does not kill the pod); readiness
MUST, so the orchestrator stops routing traffic until dependencies recover.

## Security Basics

| Control | Mechanism | Priority |
| --- | --- | --- |
| Input validation | global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` over class-validator request DTOs (see `06-interface-layer.md`) | Required |
| HTTP hardening | `helmet()` for secure headers | Required |
| Rate limiting | `@nestjs/throttler` guard, per-route limits on expensive/LLM endpoints | Prod-only |
| Secrets | from env (validated) in dev, platform secret store in prod; never logged (pino `redact`); never committed | Required |
| CORS | explicit allow-list origins, not `*`, in prod | Prod-only |
| Auth | guards on controllers; the use-case slice stays auth-agnostic | Optional |

## Bootstrap Wiring (src/main.ts) — Required order

```ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(LOGGER_PORT));            // pino adapter behind LoggerPort
app.use(helmet());                              // security headers
app.use(correlationIdMiddleware);               // AsyncLocalStorage requestId
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
app.useGlobalFilters(new GlobalExceptionFilter());
await app.listen(app.get(AppConfigService).port);
```

## Final Check

- Config validated by schema at boot; nothing reads `process.env` outside `libs/config/`.
- All code depends on `LoggerPort`, not pino directly; every log line carries `requestId`.
- Domain/business failures `return` `Result`/`Option`; technical failures `throw` `ExceptionBase`.
- Global filter maps thrown exceptions to 400/404/409/500 and never sees domain errors.
- Validation pipe, helmet, and secret hygiene are on; observability/rate-limit deferred as Prod-only.
- `libs/` imports nothing from `modules/`; cross-refs to `05-infrastructure-layer.md` and
  `06-interface-layer.md` are accurate.

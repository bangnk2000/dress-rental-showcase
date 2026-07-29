# AI-Agent-First: Machine-Readable Conventions + the AI Agent Bounded Context

This is the differentiating spec of the set. It has two halves, and they are independent — read whichever you need.

- **Half A — A codebase that is friendly to AI coding agents.** Machine-readable conventions (`AGENTS.md`, `CLAUDE.md`), CI guardrails that make layering violations un-mergeable, and deterministic scaffolding so any agent emits an identical, correct vertical slice from one command.
- **Half B — A first-class AI Agent bounded context** (`modules/ai-agent/`), modeled in the same hexagonal terms as every other context: domain entities/value objects with invariants, an `LlmPort`, a `ClaudeLlmAdapter` (`@anthropic-ai/sdk`), tool-calling, plus `evals/` and `guardrails/`.

Cross-references: directory placement is fixed in `02-folder-structure.md`; the adapter / anti-corruption layer pattern is `05-infrastructure-layer.md`; ports live in `04-application-layer.md`; domain building blocks in `03-domain-layer.md`. This file owns the *rules and enforcement*; the *session lifecycle harness* around them (`feature_list.json`, `init.sh`, `session-handoff.md`, `clean-state-checklist.md`, benchmark/cleanup scripts) is `13-harness-engineering.md` — together they are the project's operating system for agents.

> **Output-Scaling.** The fullest form below is a CEILING. A two-context CRUD service needs `AGENTS.md` + `CLAUDE.md` + a dependency-cruiser config + one plop generator — not eval harnesses or a guardrails folder. Add Half B only when the project actually ships an LLM feature. Scale guardrails to the number of layers and modules you actually have.

---

# HALF A — A Codebase Friendly to AI Coding Agents

## A.1 Why machine-readable conventions matter

An AI coding agent reads the repo before it writes. If the layering rules, the file-naming map, and the exact commands live only in a human's head (or scattered across a wiki), the agent guesses — and guesses drift. The fix is to encode the rules as **artifacts the agent reads** and **checks the agent cannot bypass**:

1. **`AGENTS.md`** (universal, tool-agnostic) and **`CLAUDE.md`** (Claude Code specifics) state the rules in prose the agent ingests on every task.
2. **CI guardrails** (`dependency-cruiser`, ESLint boundaries, naming lint) make a layering or cross-module violation fail the build — so a wrong guess never merges.
3. **Deterministic scaffolding** (`plop`) means "add a use case" is one command that emits the same correct slice every time, instead of free-form file creation.

Prose tells the agent what to do; guardrails make the wrong thing impossible; scaffolding makes the right thing trivial. You need all three.

## A.2 `AGENTS.md` template (repo root) — Required

Drop this at the repo root verbatim and fill the bracketed values. It is the single source of truth an agent reads first.

```markdown
# AGENTS.md

Domain-Driven Hexagon, AI-agent-first. Read this before writing or editing code.

## Startup (in order — see 13-harness-engineering.md)
1. Read this file, then `session-handoff.md` (previous session context).
2. Read `feature_list.json` — current slice status; ONE slice in progress at a time.
3. Run `bash init.sh` on a fresh clone / resumed session (verifies toolchain + build + DB).

## Runtime
NestJS 11 (Express 5 default) · Node 22 LTS (>= 20) · TypeScript 5.7+ · pnpm. CQRS via `@nestjs/cqrs` ^11.

## Project map
- `modules/<context>/`     — one bounded context == one mini-app. NO cross-module imports.
- `libs/`                  — shared kernel: ddd/, db/, ports/, exceptions/, utils/, decorators/.
- `modules/<context>/domain/`        — entities, value objects, domain events, domain errors. ZERO framework/IO/SDK.
- `modules/<context>/commands/<use-case>/`  — write side: command + handler + controllers + DTOs (vertical slice).
- `modules/<context>/queries/<use-case>/`   — read side: query + query-handler (may hit DB directly).
- `modules/<context>/application/event-handlers/` — domain-event handlers.
- `modules/<context>/database/`      — repository, persistence model, mapper.
- `modules/<context>/<context>.module.ts` — Nest module wiring (DI tokens → implementations).

## The four layers (dependencies point INWARD only)
Interface Adapters → Application → Domain.  Infrastructure sits on the outer ring, implementing Application ports.
- Domain imports NOTHING from outer layers. No `@nestjs/*`, no `@anthropic-ai/sdk`, no `slonik`/`typeorm`, no `Date.now()`/`crypto.randomUUID()` (inject time + ids).
- Application imports Domain + ports (interfaces), never infrastructure concretes.
- Infrastructure/Interface import Application + Domain.
- Modules talk ONLY via CommandBus / QueryBus / EventBus. No `import { X } from '../../other-module/...'`.

## File-naming map
| What | File |
| --- | --- |
| Entity | `user.entity.ts` |
| Aggregate root | `order.entity.ts` (extends AggregateRoot) |
| Value object | `address.value-object.ts` |
| Domain event | `user-created.domain-event.ts` |
| Domain errors | `user.errors.ts` (returned via Result) |
| Command | `create-user.command.ts` |
| Command handler/service | `create-user.service.ts` (implements ICommandHandler) |
| Query | `find-users.query.ts` |
| Query handler | `find-users.query-handler.ts` (implements IQueryHandler) |
| Port (interface) | `*.port.ts` — `repository.port.ts`, `logger.port.ts`, `llm.port.ts` |
| Domain-event handler | `*.domain-event-handler.ts` |
| Repository (infra) | `user.repository.ts` (extends SqlRepositoryBase) |
| Mapper | `user.mapper.ts` (toDomain/toPersistence/toResponse) |
| HTTP controller | `create-user.http.controller.ts` |
| Request DTO | `create-user.request.dto.ts` (class-validator) |
| Response DTO | `user.response.dto.ts` (intended fields only) |

## Commands (the only ones — do not invent variants)
- Install:    `pnpm install`
- Build:      `pnpm build`
- Typecheck:  `pnpm typecheck`
- Test:       `pnpm test`            (unit + integration, Jest)
- Acceptance: `pnpm test:e2e`        (Cucumber/Gherkin + supertest)
- Lint:       `pnpm lint`            (ESLint, incl. boundaries + naming)
- Arch check: `pnpm arch`            (dependency-cruiser — layering + cross-module)
- Scaffold:   `pnpm plop`            (interactive) or `pnpm plop slice -- --context billing --name create-invoice`
- Migrate:    `pnpm migrate:up` / `pnpm migrate:down`

## How to add a new use case (the ONLY recipe)
1. `pnpm plop slice -- --context <context> --name <verb-noun>`  (e.g. `--name create-invoice`).
   This emits the command, handler, controller, DTOs, and a test stub into `modules/<context>/commands/<verb-noun>/`.
2. Implement the handler: load aggregate via the repository port → call a domain method → `repo.save(...)` → return `Result<Success, DomainError>`.
3. Put business-rule violations in `*.errors.ts` and RETURN them via `Err(...)`. THROW only on technical failures.
4. Register nothing by hand if plop wired the module — otherwise add the handler to `<context>.module.ts` providers.
5. `pnpm arch && pnpm lint && pnpm test` must pass before you open a PR.

## DO
- Return domain errors as `Result<T, E>` (oxide.ts `Ok`/`Err`). Map them to HTTP status in the controller via `.match()`.
- Keep the persistence model separate from the domain entity; cross with the mapper.
- Publish aggregate events INSIDE the DB transaction (`repo.save` calls `publishEvents()`).
- Inject `DateTimeProvider` and `IdGenerator` into domain factories.

## DO NOT
- DO NOT import one module from another. Use a command/query/event.
- DO NOT import `@nestjs/*`, an ORM, or `@anthropic-ai/sdk` inside `domain/`.
- DO NOT call a command handler from another command handler. Command → Event → Command.
- DO NOT throw for business-rule violations. Return `Err(new SomethingError())`.
- DO NOT expose entity internals in a response — map through a Response DTO.
- DO NOT read the clock or generate ids inside domain code.
- DO NOT mark a slice "pass" in `feature_list.json` without runtime evidence (13-harness-engineering.md).
```

## A.3 `CLAUDE.md` template (repo root) — Required

`CLAUDE.md` is Claude Code-specific and *shorter*: it points at `AGENTS.md` for the rules and adds where-things-live + preferred-edit guidance. Do not duplicate the full naming map — reference it.

```markdown
# CLAUDE.md

Claude Code instructions. The architecture rules, file-naming map, and command list live in `AGENTS.md` — read it first; this file does not repeat them.

## Where things live (fast lookup)
- A new write use case → `modules/<context>/commands/<verb-noun>/` (scaffold it, don't hand-create).
- A new read → `modules/<context>/queries/<verb-noun>/`.
- A new external integration (SDK, HTTP, queue) → an adapter in `modules/<context>/` implementing an Application `*.port.ts`. See 05-infrastructure-layer.md.
- A shared base class or pure util → `libs/`.
- The LLM lives behind `LlmPort` in `modules/ai-agent/` — NEVER import `@anthropic-ai/sdk` outside the adapter. See 08 Half B.

## Preferred edit patterns
- Generate a slice with `pnpm plop slice -- --context <c> --name <verb-noun>`, then fill the handler. Do not free-hand the file set.
- One bounded context per task. If a change spans two contexts, it is two changes that communicate via an event — flag it, do not import across.
- Edit the smallest set of files. A new command touches: command, handler, controller, request DTO, response DTO, test. Nothing in another module.
- After editing, run `pnpm typecheck && pnpm arch && pnpm lint && pnpm test`. Fix what they report before finishing.

## Model defaults (when the task involves the LLM)
- Default app model: `claude-sonnet-4-6` (balanced — agent workloads).
- Hard reasoning / planning: `claude-opus-4-8`.
- Cheap / high-volume classification: `claude-haiku-4-5-20251001`.
- Most capable (rare, costliest): `claude-fable-5`.
- These are configured via the `LlmPort`, never hard-coded in a handler. Pass the model as a parameter of the port call.

## Guardrails you cannot bypass
`pnpm arch` (dependency-cruiser) fails the build on inner→outer imports and cross-module imports. If it fails, you broke layering — fix the import, do not weaken the rule.
```

## A.4 Architecture guardrails in CI — Required

These run in CI so an agent **cannot** silently break layering. Three layers of enforcement.

### A.4.1 dependency-cruiser ruleset

`.dependency-cruiser.cjs` at the repo root. Forbids inner→outer imports, cross-module imports, and the SDK in the domain.

```javascript
// .dependency-cruiser.cjs
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-stays-pure',
      comment: 'Domain must not import framework, IO, ORM, or any SDK.',
      severity: 'error',
      from: { path: 'modules/[^/]+/domain' },
      to: {
        path: [
          '@nestjs',
          '@anthropic-ai/sdk',
          'slonik',
          'typeorm',
          '@prisma/client',
          'class-validator',
        ],
      },
    },
    {
      name: 'application-no-infra-concretes',
      comment: 'Application depends on ports (interfaces), not on database/ adapters.',
      severity: 'error',
      from: { path: 'modules/[^/]+/(commands|queries|application)' },
      to: { path: 'modules/[^/]+/(database|adapters)' },
    },
    {
      name: 'no-cross-module-imports',
      comment: 'Modules talk via CommandBus/QueryBus/EventBus only — never direct imports.',
      severity: 'error',
      from: { path: 'modules/([^/]+)/.+' },
      to: {
        path: 'modules/([^/]+)/.+',
        // import is allowed only when the captured module name matches (same module)
        pathNot: 'modules/$1/.+',
      },
    },
    {
      name: 'sdk-only-in-adapter',
      comment: 'The Anthropic SDK may only be imported by a *.adapter.ts file.',
      severity: 'error',
      from: { pathNot: '\\.adapter\\.ts$' },
      to: { path: '@anthropic-ai/sdk' },
    },
    {
      name: 'no-orphans',
      comment: 'Dead files rot — delete or wire them up.',
      severity: 'warn',
      from: { orphan: true, pathNot: '\\.(d\\.ts|spec\\.ts|config\\.(js|cjs|ts))$' },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
```

Run with `pnpm arch` → `depcruise modules libs --config .dependency-cruiser.cjs`.

### A.4.2 ESLint boundary config (sketch)

`eslint-plugin-boundaries` enforces the same layering at lint time (faster feedback than the full graph crawl). Tag each layer, then declare which tag may depend on which.

```json
{
  "plugins": ["boundaries"],
  "settings": {
    "boundaries/elements": [
      { "type": "domain",         "pattern": "modules/*/domain" },
      { "type": "application",    "pattern": "modules/*/(commands|queries|application)" },
      { "type": "infrastructure", "pattern": "modules/*/(database|adapters)" },
      { "type": "interface",      "pattern": "modules/*/**/*.(http|cli|message).controller.ts" }
    ]
  },
  "rules": {
    "boundaries/element-types": ["error", {
      "default": "disallow",
      "rules": [
        { "from": "domain",         "allow": ["domain"] },
        { "from": "application",    "allow": ["application", "domain"] },
        { "from": "infrastructure", "allow": ["infrastructure", "application", "domain"] },
        { "from": "interface",      "allow": ["application", "domain"] }
      ]
    }]
  }
}
```

### A.4.3 Naming lint

A filename-pattern rule (`eslint-plugin-check-file` or a small custom rule) keeps the file-naming map enforced, so an agent's `userService.ts` is rejected in favor of `create-user.service.ts`:

```json
{
  "rules": {
    "check-file/filename-naming-convention": ["error", {
      "modules/**/domain/**/*.entity.ts": "KEBAB_CASE",
      "modules/**/commands/**/*.command.ts": "KEBAB_CASE",
      "modules/**/commands/**/*.service.ts": "KEBAB_CASE",
      "modules/**/**/*.{http,cli,message}.controller.ts": "KEBAB_CASE",
      "modules/**/**/*.{request,response}.dto.ts": "KEBAB_CASE"
    }],
    "check-file/folder-naming-convention": ["error", { "modules/**/": "KEBAB_CASE" }]
  }
}
```

### A.4.4 Pre-commit + CI step

Wire the guardrails into both a fast local hook and CI so a violation is caught before review.

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "arch": "depcruise modules libs --config .dependency-cruiser.cjs",
    "test": "jest",
    "verify": "pnpm typecheck && pnpm lint && pnpm arch && pnpm test"
  }
}
```

```bash
# .husky/pre-commit  (lint-staged for speed locally; CI runs the full gate)
pnpm lint-staged && pnpm arch
```

```yaml
# .github/workflows/ci.yml (excerpt)
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify           # typecheck + lint + arch + test — all must pass
      - run: pnpm test:e2e
```

## A.5 Deterministic scaffolding with plop — Required

One command emits an identical, correct vertical slice every time. This is what makes "add a use case" reproducible across agents and humans.

`plopfile.cjs` at the repo root:

```javascript
// plopfile.cjs
module.exports = function (plop) {
  plop.setGenerator('slice', {
    description: 'A write-side vertical slice: command + handler + controller + DTOs + test',
    prompts: [
      { type: 'input', name: 'context', message: 'Bounded context (kebab-case), e.g. billing' },
      { type: 'input', name: 'name',    message: 'Use case (verb-noun, kebab-case), e.g. create-invoice' },
    ],
    actions: [
      { type: 'add', path: 'modules/{{context}}/commands/{{name}}/{{name}}.command.ts',          templateFile: 'tools/plop-templates/command.hbs' },
      { type: 'add', path: 'modules/{{context}}/commands/{{name}}/{{name}}.service.ts',          templateFile: 'tools/plop-templates/service.hbs' },
      { type: 'add', path: 'modules/{{context}}/commands/{{name}}/{{name}}.http.controller.ts',  templateFile: 'tools/plop-templates/http-controller.hbs' },
      { type: 'add', path: 'modules/{{context}}/commands/{{name}}/{{name}}.request.dto.ts',      templateFile: 'tools/plop-templates/request-dto.hbs' },
      { type: 'add', path: 'modules/{{context}}/commands/{{name}}/{{name}}.service.spec.ts',     templateFile: 'tools/plop-templates/service-spec.hbs' },
    ],
  });
};
```

```bash
# Interactive
pnpm plop

# Deterministic (what an agent runs) — same input, same files, every time
pnpm plop slice -- --context billing --name create-invoice
```

A handler template (`tools/plop-templates/service.hbs`) bakes the correct shape so the agent only fills the body — see Half B and `04-application-layer.md` for the full handler pattern.

```typescript
// modules/{{context}}/commands/{{name}}/{{pascalCase name}}.service.ts (template output)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, Ok, Err } from 'oxide.ts';
import { {{pascalCase name}}Command } from './{{name}}.command';

@CommandHandler({{pascalCase name}}Command)
export class {{pascalCase name}}Service
  implements ICommandHandler<{{pascalCase name}}Command, Result<string, Error>>
{
  // inject the repository PORT (interface) + clock/id provider here
  async execute(command: {{pascalCase name}}Command): Promise<Result<string, Error>> {
    // 1. load aggregate via repository port
    // 2. call a domain method (invariants protected inside the entity)
    // 3. await repo.save(aggregate)  -> publishes events inside the txn
    // 4. return Ok(id) | Err(new SomethingError())
    return Err(new Error('not implemented'));
  }
}
```

---

# HALF B — A First-Class AI Agent Bounded Context

`modules/ai-agent/` is a bounded context like any other — same four layers, same rules. The LLM is **always** an adapter behind a port; domain and application never touch `@anthropic-ai/sdk`. Placement is fixed in `02-folder-structure.md`.

## B.1 Folder layout

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `modules/ai-agent/domain/` | Pure agent domain | `agent.entity.ts`, `conversation.entity.ts` (AggregateRoot), `message.entity.ts`, `tool.value-object.ts`, `prompt-template.value-object.ts`, `*.domain-event.ts`, `agent.errors.ts` | Required |
| `modules/ai-agent/commands/` | Write use cases | `send-message/`, `run-agent-turn/` (command + handler + controller + DTOs) | Required |
| `modules/ai-agent/queries/` | Read side | `get-conversation/` (query + query-handler) | Optional |
| `modules/ai-agent/application/ports/` | Abstractions | `llm.port.ts`, `tool-registry.port.ts`, `conversation.repository.port.ts` | Required |
| `modules/ai-agent/adapters/` | Anti-corruption layer | `claude-llm.adapter.ts` (implements `LlmPort` with `@anthropic-ai/sdk`) | Required |
| `modules/ai-agent/database/` | Persistence | `conversation.repository.ts`, `conversation.mapper.ts`, persistence model | Required |
| `modules/ai-agent/evals/` | Offline quality gates | golden-set fixtures, scenario specs, `eval.runner.ts`, regression thresholds | Prod-only |
| `modules/ai-agent/guardrails/` | Input/output safety | prompt-injection checks, output schema validation, PII redaction, refusal handling | Prod-only |
| `modules/ai-agent/ai-agent.module.ts` | Wiring | binds `LlmPort` DI token → `ClaudeLlmAdapter` | Required |

## B.2 Domain building blocks (invariants live here)

Pure TypeScript — no `@nestjs/*`, no SDK, no IO. Time and ids are injected.

```typescript
// modules/ai-agent/domain/conversation.entity.ts
import { AggregateRoot } from '@libs/ddd/aggregate-root.base';
import { Result, Ok, Err } from 'oxide.ts';
import { Message } from './message.entity';
import { MessageAddedDomainEvent } from './message-added.domain-event';
import { ConversationClosedError, EmptyMessageError } from './agent.errors';

interface ConversationProps {
  agentId: string;
  messages: Message[];
  closed: boolean;
}

export class Conversation extends AggregateRoot<ConversationProps> {
  // No public setters. Mutation only through methods that protect invariants.
  static create(props: { agentId: string; id: string; now: Date }): Conversation {
    return new Conversation({ id: props.id, createdAt: props.now, updatedAt: props.now,
      props: { agentId: props.agentId, messages: [], closed: false } });
  }

  addUserMessage(text: string, msg: { id: string; now: Date }): Result<Message, EmptyMessageError | ConversationClosedError> {
    if (this.props.closed) return Err(new ConversationClosedError());
    if (text.trim().length === 0) return Err(new EmptyMessageError());
    const message = Message.create({ id: msg.id, role: 'user', text, createdAt: msg.now });
    this.props.messages.push(message);
    this.addEvent(new MessageAddedDomainEvent({ aggregateId: this.id, messageId: message.id }));
    return Ok(message);
  }

  get history(): readonly Message[] { return this.props.messages; }

  protected validate(): void {
    if (this.props.messages.length > 1000) throw new Error('Conversation exceeds max length');
  }
}
```

- `Agent` (entity): identity, equality by id, holds which `PromptTemplate` and tool set it may use; `static create()` factory.
- `Message` (entity): role (`user`/`assistant`/`tool`), text/tool-call payload, ordering.
- `Tool` (value object): immutable `{ name, description, inputSchema }`, structural equality, guard-validated in the constructor.
- `PromptTemplate` (value object): immutable template + variable contract; renders deterministically (no clock/random inside).
- Domain errors (`agent.errors.ts`): `ConversationClosedError`, `EmptyMessageError`, `ToolNotAllowedError` — RETURNED via `Result`, never thrown.

## B.3 `LlmPort` — the interface the application depends on

The application layer knows only this interface. It never imports the SDK. The model is a *parameter*, so a handler chooses `claude-sonnet-4-6` (default), `claude-opus-4-8` (hard reasoning), `claude-haiku-4-5-20251001` (cheap), or `claude-fable-5` (most capable) without any code change in the adapter.

```typescript
// modules/ai-agent/application/ports/llm.port.ts
import { Result } from 'oxide.ts';

export const LLM_PORT = Symbol('LlmPort'); // DI token

export type LlmModel =
  | 'claude-sonnet-4-6'             // balanced default for agent workloads
  | 'claude-opus-4-8'              // deep reasoning / planning
  | 'claude-haiku-4-5-20251001'   // fast / cheap classification
  | 'claude-fable-5';             // most capable (rare, costliest)

export interface LlmToolDef {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>; // JSON Schema, additionalProperties:false
}

export interface LlmMessage {
  readonly role: 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolUseId?: string;
}

export interface LlmCompletionRequest {
  readonly model: LlmModel;
  readonly system: string;
  readonly messages: LlmMessage[];
  readonly tools?: LlmToolDef[];
  readonly maxTokens: number;
}

export type LlmStop = 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal';

export interface LlmToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

export interface LlmCompletion {
  readonly stop: LlmStop;
  readonly text: string;
  readonly toolCalls: LlmToolCall[];
  readonly usage: { inputTokens: number; outputTokens: number };
}

export class LlmUnavailableError extends Error {} // technical failure → may be thrown by callers
export class LlmRefusalError extends Error {}      // domain-relevant → returned as Result

export interface LlmPort {
  complete(req: LlmCompletionRequest): Promise<Result<LlmCompletion, LlmRefusalError>>;
}
```

Note the port speaks **domain vocabulary** (`LlmMessage`, `LlmToolCall`), not SDK types. That is the anti-corruption boundary: nothing about Anthropic's wire shape leaks inward.

## B.4 `ClaudeLlmAdapter` — the only file that imports the SDK

The adapter implements `LlmPort` using `@anthropic-ai/sdk`. It translates domain types ↔ SDK types and maps SDK failure modes onto the port's contract. Filename ends in `.adapter.ts` so the dependency-cruiser `sdk-only-in-adapter` rule permits the import.

```typescript
// modules/ai-agent/adapters/claude-llm.adapter.ts
import { Injectable, Inject } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Result, Ok, Err } from 'oxide.ts';
import {
  LlmPort, LlmCompletionRequest, LlmCompletion, LlmRefusalError, LlmToolCall,
} from '../application/ports/llm.port';
import { LOGGER_PORT, LoggerPort } from '@libs/ports/logger.port';

@Injectable()
export class ClaudeLlmAdapter implements LlmPort {
  private readonly client: Anthropic;

  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {
    // API key from @nestjs/config (zod-validated) — never hard-coded.
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async complete(req: LlmCompletionRequest): Promise<Result<LlmCompletion, LlmRefusalError>> {
    try {
      const res = await this.client.messages.create({
        model: req.model,              // 'claude-sonnet-4-6' default — chosen by the caller
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages.map((m) => ({
          role: m.role === 'tool' ? 'user' : m.role,
          content: m.toolUseId
            ? [{ type: 'tool_result', tool_use_id: m.toolUseId, content: m.content }]
            : m.content,
        })),
        tools: req.tools?.map((t) => ({
          name: t.name, description: t.description, input_schema: t.inputSchema as never,
        })),
      });

      // Domain-relevant: a safety refusal is a Result, not an exception.
      if (res.stop_reason === 'refusal') {
        return Err(new LlmRefusalError('Model declined to respond'));
      }

      const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
      const toolCalls: LlmToolCall[] = res.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => {
          const t = b as { id: string; name: string; input: Record<string, unknown> };
          return { id: t.id, name: t.name, input: t.input };
        });

      return Ok({
        stop: res.stop_reason as LlmCompletion['stop'],
        text,
        toolCalls,
        usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      });
    } catch (err) {
      // Technical failure (network, 5xx, rate limit) → THROW, fail-fast. Global filter handles it.
      this.logger.error('Claude request failed', { err });
      throw err;
    }
  }
}
```

Key behaviors:
- **Business vs technical split.** A `refusal` is a documented `Result` error (the caller can recover — e.g. tell the user). A network/5xx/rate-limit failure is THROWN (fail-fast), caught by the global exception filter. This matches the error-handling rule in `01-architecture-principles.md`.
- **No domain leakage.** SDK request/response shapes never escape the adapter.
- **Model is data.** Switching to `claude-opus-4-8` for a hard turn is a `req.model` value, not an adapter edit.

Wiring (`ai-agent.module.ts`) binds the token to the adapter:

```typescript
// modules/ai-agent/ai-agent.module.ts (excerpt)
providers: [
  { provide: LLM_PORT, useClass: ClaudeLlmAdapter },
  // ...command handlers, repository binding, tool registry
],
```

## B.5 Tool-calling flow (Command → Event → Command)

The agent turn is a command handler that orchestrates the port and the tool registry. It obeys the rule from `04-application-layer.md`: **a command never calls another command directly** — work that follows a tool result is dispatched as an event, then a command.

```typescript
// modules/ai-agent/commands/run-agent-turn/run-agent-turn.service.ts (orchestration shape)
// 1. Load Conversation aggregate via the repository port.
// 2. llm.complete({ model: 'claude-sonnet-4-6', system, messages, tools }) → Result.
// 3. If Err(LlmRefusalError) → record + return Err to the controller (maps to a safe response).
// 4. If Ok and stop === 'tool_use':
//      for each toolCall: validate against the allowed Tool VO (ToolNotAllowedError if not),
//      execute via tool-registry.port, append a tool-result Message to the aggregate,
//      addEvent(ToolResultRecordedDomainEvent), repo.save(...) (publishes inside the txn).
//      A domain-event handler then dispatches the NEXT run-agent-turn command — NOT a direct call.
// 5. If Ok and stop === 'end_turn' → append assistant Message, repo.save, return Ok(message).
```

The loop is therefore: `RunAgentTurnCommand` → `MessageAdded`/`ToolResultRecorded` event → (event handler) → next `RunAgentTurnCommand`. No command imports another command; modules and turns stay decoupled.

## B.6 `evals/` and `guardrails/` — Prod-only

- **`evals/`** — offline quality gates the agent runs before shipping a prompt or model change. A golden set of `(input, expected-property)` fixtures plus an `eval.runner.ts` that calls the real `LlmPort` and asserts properties (not exact strings): "answer cites a source", "tool X is selected for this intent", "no PII echoed". Wire a regression threshold into CI so a prompt edit that drops eval pass-rate fails the build — the agent-facing analog of the unit-test gate in `09-testing-strategy.md`.
- **`guardrails/`** — runtime input/output safety, applied in the command handler around the `LlmPort` call:
  - **Input:** prompt-injection screening on untrusted user content; size/PII checks before it reaches the model.
  - **Output:** validate tool-call `input` against the tool's JSON Schema before execution; redact PII from responses; handle the `refusal` `Result` path explicitly (never surface raw refusal internals).

Both folders are optional for a project that ships only a thin LLM feature; add them when the agent is autonomous or user-facing. Scale to need, per Output-Scaling.

## B.7 Quick checklist for the AI Agent context

- [ ] `@anthropic-ai/sdk` imported in exactly one file: `claude-llm.adapter.ts` (enforced by dependency-cruiser).
- [ ] Domain (`Agent`, `Conversation`, `Message`, `Tool`, `PromptTemplate`) is pure — no SDK, no `@nestjs/*`, injected time/ids.
- [ ] `LlmPort` speaks domain types; model is a parameter (`claude-sonnet-4-6` default).
- [ ] Refusals returned as `Result`; network/technical failures thrown.
- [ ] Tool loop runs Command → Event → Command, never command→command.
- [ ] `evals/` + `guardrails/` present when the agent is autonomous or user-facing; omitted for thin features.

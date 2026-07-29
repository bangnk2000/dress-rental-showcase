# Example Output (one-shot reference)

This file shows the expected output for a **standard-complexity** request against the DDD-Hexagon
+ NestJS stack, so an AI coding agent can anchor on the right depth, tone, file naming, and layer
discipline. It demonstrates the Output-Scaling rule (see `00-system-prompt.md`): the fullest format
is a CEILING — here we produce ONE vertical slice (one command + one query) inside ONE bounded
context, not an entire platform.

For the rules behind each artifact, see the sibling specs: layer/dependency rules in
`01-architecture-principles.md`, the folder map in `02-folder-structure.md`, building blocks in
`03-domain-layer.md`, CQRS handlers + ports in `04-application-layer.md`, repositories/adapters in
`05-infrastructure-layer.md`, controllers/DTOs in `06-interface-layer.md`, the LLM port pattern in
`08-ai-agent-first.md`, and test layout in `09-testing-strategy.md`. To generate this same slice
deterministically, see `10-module-scaffold-prompt.md`.

---

## USER REQUEST

> I want a small backend feature for an AI assistant: a user can start a conversation by sending a
> first message, and we reply using Claude. We also need to fetch a conversation by id. NestJS +
> TypeScript please.

---

## MODEL OUTPUT

# Module: conversations

## 1. Assumptions
- **Scope**: one bounded context (`conversations`) exposing one command (`start-conversation`) and
  one query (`get-conversation`). Standard depth — not a multi-context platform.
- **Stack**: NestJS + TypeScript, CQRS via `@nestjs/cqrs`, `Result<T,E>` via `oxide.ts`.
- **Persistence**: Slonik (raw SQL) behind a repository port — preferred for explicit control; a
  TypeORM/Prisma variant is acceptable for simpler needs (see `05-infrastructure-layer.md`).
- **LLM**: `@anthropic-ai/sdk`, default model `claude-sonnet-4-6`, accessed ONLY through `LlmPort`.
  The SDK is an adapter (anti-corruption layer); domain and application layers never import it.
- **Time / ids** are injected, never read directly in the domain (see `03-domain-layer.md`).
- **Auth, streaming, multi-turn replies** are out of scope here (see §8 Optional Extensions).

## 2. Bounded Contexts
| Context | Role | Notes |
| --- | --- | --- |
| `conversations` | Owns conversation lifecycle: start, store, fetch. | The slice authored here. |
| `ai-agent` (shared kernel) | Hosts `LlmPort` + `ClaudeLlmAdapter`, prompt templates, evals, guardrails. | Reused via DI; `conversations` depends on the **port**, never the adapter. See `08-ai-agent-first.md`. |

Modules never import each other's internals — they communicate via the command/query bus or domain
events (`01-architecture-principles.md`). Here `conversations` consumes `LlmPort` provided by the
`ai-agent` module through Nest DI tokens.

## 3. Folder Tree (the slice)

```
src/modules/conversations/
├── domain/
│   ├── conversation.entity.ts             # AggregateRoot
│   ├── message.value-object.ts            # immutable VO
│   ├── events/
│   │   ├── conversation-started.domain-event.ts
│   │   └── assistant-reply-appended.domain-event.ts
│   └── conversation.errors.ts             # domain errors returned via Result
├── commands/
│   └── start-conversation/
│       ├── start-conversation.command.ts
│       ├── start-conversation.service.ts  # ICommandHandler
│       ├── start-conversation.http.controller.ts
│       ├── start-conversation.request.dto.ts
│       └── start-conversation.service.spec.ts
├── queries/
│   └── get-conversation/
│       ├── get-conversation.query.ts
│       ├── get-conversation.query-handler.ts
│       └── get-conversation.http.controller.ts
├── application/
│   └── ports/
│       └── conversation.repository.port.ts
├── database/
│   ├── conversation.repository.ts         # implements port, extends SqlRepositoryBase
│   └── conversation.mapper.ts             # toDomain / toPersistence / toResponse
├── dtos/
│   └── conversation.response.dto.ts
└── conversations.module.ts
```

The shared `LlmPort` lives under `src/modules/ai-agent/application/ports/llm.port.ts`; its
`ClaudeLlmAdapter` under `src/modules/ai-agent/adapters/claude-llm.adapter.ts`.

## 4. Folder-by-Folder
| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `domain/` | Pure business model, zero IO/SDK/framework. | Aggregate, value objects, domain events, domain errors. | Required |
| `commands/start-conversation/` | One state-changing use case (vertical slice). | command, handler service, controller, request DTO, spec. | Required |
| `queries/get-conversation/` | Read side; may bypass domain and hit the DB directly. | query, query handler, controller. | Required |
| `application/ports/` | Interfaces abstracting infra, injected via DI tokens. | `conversation.repository.port.ts`. | Required |
| `database/` | Persistence model + repository + mapper. | Slonik repository, mapper. | Required |
| `dtos/` | Shared response DTOs exposing only intended fields. | `conversation.response.dto.ts`. | Required |
| `conversations.module.ts` | Wires controllers, handlers, providers, DI tokens. | NestModule registration. | Required |
| `application/event-handlers/` | Domain-event handlers (Command → Event → Command). | added when a second use case reacts to `ConversationStarted`. | Optional |
| `ai-agent/` (shared) | `LlmPort` + `ClaudeLlmAdapter`, evals, guardrails. | see `08-ai-agent-first.md`. | Required |

## 5. Key Files to Create First

### `domain/conversation.entity.ts`
AggregateRoot with a `create()` factory and a method that raises a domain event. No public setters;
invariants protected in `validate()`. See `03-domain-layer.md`.

```ts
import { AggregateRoot } from '@libs/ddd/aggregate-root.base';
import { ArgumentInvalidException } from '@libs/exceptions';
import { ConversationStartedDomainEvent } from './events/conversation-started.domain-event';
import { AssistantReplyAppendedDomainEvent } from './events/assistant-reply-appended.domain-event';
import { Message } from './message.value-object';

export interface ConversationProps {
  userId: string;
  messages: Message[];
}

interface CreateConversationProps {
  id: string;
  userId: string;
  firstMessage: Message;
  now: Date; // time is injected, never read from the domain
}

export class ConversationEntity extends AggregateRoot<ConversationProps> {
  static create(props: CreateConversationProps): ConversationEntity {
    const conversation = new ConversationEntity({
      id: props.id,
      createdAt: props.now,
      updatedAt: props.now,
      props: { userId: props.userId, messages: [props.firstMessage] },
    });
    conversation.addEvent(
      new ConversationStartedDomainEvent({
        aggregateId: props.id,
        userId: props.userId,
      }),
    );
    return conversation;
  }

  /** Mutate via behavior, not setters; bumps time and raises a DISTINCT domain event. */
  appendAssistantReply(content: string, now: Date): void {
    const reply = Message.create({ role: 'assistant', content });
    this.props.messages.push(reply);
    this.setUpdatedAt(now); // base mutator — never assign this.props.updatedAt
    this.addEvent(
      new AssistantReplyAppendedDomainEvent({
        aggregateId: this.id,
        userId: this.props.userId,
      }),
    );
  }

  get messages(): readonly Message[] {
    return this.props.messages;
  }

  get userId(): string {
    return this.props.userId;
  }

  public validate(): void {
    if (this.props.messages.length === 0) {
      throw new ArgumentInvalidException('Conversation must have at least one message');
    }
  }
}
```

### `commands/start-conversation/start-conversation.command.ts`
```ts
import { Command, CommandProps } from '@libs/ddd/command.base';

export class StartConversationCommand extends Command {
  readonly userId: string;
  readonly firstMessage: string;

  constructor(props: CommandProps<StartConversationCommand>) {
    super(props);
    this.userId = props.userId;
    this.firstMessage = props.firstMessage;
  }
}
```

### `commands/start-conversation/start-conversation.service.ts`
`ICommandHandler` that orchestrates domain + repository, calls `LlmPort`, and returns
`Result<Success, DomainError>`. Technical failures (DB/network) are thrown; business outcomes are
returned. See `04-application-layer.md`.

```ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, Ok, Err } from 'oxide.ts';
import { ConversationEntity } from '../../domain/conversation.entity';
import { Message } from '../../domain/message.value-object';
import { EmptyMessageError } from '../../domain/conversation.errors';
import {
  ConversationRepositoryPort,
  CONVERSATION_REPOSITORY,
} from '../../application/ports/conversation.repository.port';
import { LlmPort, LLM_PORT } from '@modules/ai-agent/application/ports/llm.port';

export type StartConversationResult = Result<string, EmptyMessageError>;

@CommandHandler(StartConversationCommand)
export class StartConversationService
  implements ICommandHandler<StartConversationCommand, StartConversationResult>
{
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly repo: ConversationRepositoryPort,
    @Inject(LLM_PORT)
    private readonly llm: LlmPort,
  ) {}

  async execute(command: StartConversationCommand): Promise<StartConversationResult> {
    if (command.firstMessage.trim().length === 0) {
      return Err(new EmptyMessageError()); // business rule -> returned
    }

    const now = new Date(); // injected at the edge; pure domain stays time-free
    const conversation = ConversationEntity.create({
      id: this.repo.nextId(),
      userId: command.userId,
      firstMessage: Message.create({ role: 'user', content: command.firstMessage }),
      now,
    });

    const completion = await this.llm.complete({
      messages: [{ role: 'user', content: command.firstMessage }],
    }); // technical failure throws -> global exception filter

    conversation.appendAssistantReply(completion.content, now);

    await this.repo.insert(conversation); // publishes events inside the DB transaction
    return Ok(conversation.id);
  }
}
```

### `ai-agent/application/ports/llm.port.ts`
The port the application depends on. No SDK types leak across this boundary. This is a deliberately
minimal port (it throws on technical failure); `08-ai-agent-first.md` defines the fuller `LlmPort`
that also models tool-calls and safety refusals (the latter returned as a `Result`).

```ts
export const LLM_PORT = Symbol('LLM_PORT');

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  model?: string;
  maxTokens?: number;
}

export interface LlmCompletion {
  content: string;
  model: string;
}

export interface LlmPort {
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
}
```

### `ai-agent/adapters/claude-llm.adapter.ts`
Anti-corruption adapter implementing `LlmPort` with `@anthropic-ai/sdk`. Default model
`claude-sonnet-4-6` (never legacy `claude-3-*`). See `08-ai-agent-first.md`.

```ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import {
  LlmPort,
  LlmCompletionRequest,
  LlmCompletion,
} from '../application/ports/llm.port';

@Injectable()
export class ClaudeLlmAdapter implements LlmPort {
  private readonly client: Anthropic;
  private readonly defaultModel = 'claude-sonnet-4-6';

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({ apiKey: this.config.getOrThrow('ANTHROPIC_API_KEY') });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const model = request.model ?? this.defaultModel;
    const response = await this.client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 1024,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return { content: text, model };
  }
}
```

### `commands/start-conversation/start-conversation.http.controller.ts`
Dispatches via `commandBus`, then `match()`es the Result and maps domain errors to HTTP status.

```ts
import { Body, BadRequestException, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { match } from 'oxide.ts';
import { StartConversationCommand } from './start-conversation.command';
import { StartConversationRequestDto } from './start-conversation.request.dto';
import { EmptyMessageError } from '../../domain/conversation.errors';
import { StartConversationResult } from './start-conversation.service';

@Controller('v1/conversations')
export class StartConversationHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async start(@Body() body: StartConversationRequestDto): Promise<{ id: string }> {
    const result: StartConversationResult = await this.commandBus.execute(
      new StartConversationCommand({ userId: body.userId, firstMessage: body.message }),
    );

    return match(result, {
      Ok: (id: string) => ({ id }),
      Err: (error: Error) => {
        if (error instanceof EmptyMessageError) {
          throw new BadRequestException(error.message); // 400 — empty input is a validation error
        }
        throw error; // unknown -> global exception filter
      },
    });
  }
}
```

### `commands/start-conversation/start-conversation.request.dto.ts`
```ts
import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class StartConversationRequestDto {
  @IsUUID()
  readonly userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  readonly message: string;
}
```

### `dtos/conversation.response.dto.ts`
Exposes ONLY intended fields (no internal aggregate shape).

```ts
export class MessageResponseDto {
  role: 'user' | 'assistant';
  content: string;
}

export class ConversationResponseDto {
  id: string;
  userId: string;
  messages: MessageResponseDto[];
  createdAt: string;
}
```

### `database/conversation.mapper.ts`
`toDomain` / `toPersistence` / `toResponse`; persistence model kept separate from the entity.

```ts
import { Injectable } from '@nestjs/common';
import { Mapper } from '@libs/ddd/mapper.interface';
import { ConversationEntity } from '../domain/conversation.entity';
import { Message } from '../domain/message.value-object';
import { ConversationResponseDto } from '../dtos/conversation.response.dto';

export interface ConversationModel {
  id: string;
  user_id: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ConversationMapper
  implements Mapper<ConversationEntity, ConversationModel, ConversationResponseDto>
{
  toPersistence(entity: ConversationEntity): ConversationModel {
    const copy = entity.getProps();
    return {
      id: copy.id,
      user_id: copy.userId,
      messages: copy.messages.map((m) => ({ role: m.role, content: m.content })),
      created_at: copy.createdAt,
      updated_at: copy.updatedAt,
    };
  }

  toDomain(record: ConversationModel): ConversationEntity {
    return new ConversationEntity({
      id: record.id,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      props: {
        userId: record.user_id,
        messages: record.messages.map((m) => Message.create({ role: m.role, content: m.content })),
      },
    });
  }

  toResponse(entity: ConversationEntity): ConversationResponseDto {
    const copy = entity.getProps();
    const dto = new ConversationResponseDto();
    dto.id = copy.id;
    dto.userId = copy.userId;
    dto.messages = copy.messages.map((m) => ({ role: m.role, content: m.content }));
    dto.createdAt = copy.createdAt.toISOString();
    return dto;
  }
}
```

## 6. AGENTS.md snippet (module-local)
Drop this in `src/modules/conversations/AGENTS.md` so any agent extends the slice correctly.

```md
# conversations — agent guide

Layers (deps point inward; inner NEVER imports outer):
  interface -> application -> domain ; infrastructure implements application ports.

Where to add a new use case:
  - State-changing  -> commands/<use-case>/ : *.command.ts, *.service.ts (ICommandHandler),
    *.http.controller.ts, *.request.dto.ts.
  - Read-only       -> queries/<use-case>/  : *.query.ts, *.query-handler.ts (may hit DB directly).

Rules:
  - Domain has ZERO framework/IO/SDK imports. Inject time + ids; never read Date/uuid in domain.
  - LLM access ONLY via LlmPort (Symbol LLM_PORT). NEVER import @anthropic-ai/sdk here — that lives
    in modules/ai-agent. Default model: claude-sonnet-4-6.
  - Business errors -> return Result (Err); technical failures -> throw (global filter).
  - No cross-module imports; talk via command/query bus or domain events.
  - Command -> Event -> Command (never call a command from another command).

Commands: pnpm build · pnpm test · pnpm lint · pnpm arch · pnpm plop slice
```

## 7. Architecture Rationale
The vertical slice keeps everything that changes together in one folder (Common Closure): the
command, its handler, controller, and request DTO ship as a unit. The domain `ConversationEntity`
holds the only invariants and raises `ConversationStartedDomainEvent`, while time and ids enter from
the handler — so the aggregate stays pure and trivially unit-testable. Claude sits behind `LlmPort`,
so swapping models or providers, stubbing in tests, and enforcing guardrails all happen in the
adapter without touching application logic. Business outcomes travel as `Result` (explicit,
documented in return types); only technical faults throw. `dependency-cruiser` + eslint boundaries
forbid inner→outer and cross-module imports in CI, so an agent cannot silently break layering.

## 8. Optional Extensions
- **Continue a conversation**: `commands/send-message/` reusing `LlmPort` and the same aggregate.
- **Streaming replies**: add `streamComplete()` to `LlmPort`, an SSE controller; adapter only.
- **Event reactions**: `application/event-handlers/conversation-started.domain-event-handler.ts`
  to fire analytics/titling via a follow-up command (Command → Event → Command).
- **Read model**: a denormalized projection for `get-conversation` to bypass the aggregate entirely.
- **AI hardening**: prompt templates, evals, and guardrails in `modules/ai-agent/` (`08-ai-agent-first.md`).
- **Acceptance tests**: Cucumber/Gherkin + supertest e2e for the start→reply flow (`09-testing-strategy.md`).

## 9. Implementation Checklist
- [ ] Scaffold the slice (`pnpm plop slice -- --context conversations --name start-conversation`).
- [ ] Implement `conversation.entity.ts` + `message.value-object.ts` + domain event + errors.
- [ ] Define `conversation.repository.port.ts` and `nextId()`.
- [ ] Implement `start-conversation.service.ts` returning `Result`, calling `LlmPort`.
- [ ] Wire `ClaudeLlmAdapter` (model `claude-sonnet-4-6`) behind `LLM_PORT` in `ai-agent`.
- [ ] Add controllers + request/response DTOs with `class-validator`.
- [ ] Implement `conversation.repository.ts` (Slonik) + `conversation.mapper.ts`.
- [ ] Add `get-conversation.query` + `get-conversation.query-handler.ts` (read side).
- [ ] Register everything in `conversations.module.ts`; add module `AGENTS.md`.
- [ ] Unit-test the handler (stub `LlmPort`); add e2e for start→reply.
- [ ] Run `pnpm arch` + `pnpm lint` to confirm layering holds.

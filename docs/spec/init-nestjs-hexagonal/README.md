# Prompt Set: Initialize an AI-Agent-First NestJS Hexagonal/DDD Backend

This folder is a **reusable prompt set** that an AI coding agent (Claude Code, Cursor, etc.) consumes to bootstrap and extend a production-grade backend using **NestJS + TypeScript**, Hexagonal Architecture, Domain-Driven Design, and CQRS. The architecture is derived from [Sairyss/domain-driven-hexagon](https://github.com/Sairyss/domain-driven-hexagon) and adapted to be **AI-agent-first**.

These are spec/prompt documents — not runnable code. You feed the relevant files to an agent as context; the agent generates the repository, a vertical slice, or a fix that conforms to the rules below.

## What "AI-Agent-First" Means Here

Two distinct ideas, both load-bearing:

1. **The codebase is designed so AI agents and humans extend it safely.** Layer + dependency rules are explicit, file naming is deterministic, and architecture guardrails run in CI (dependency-cruiser forbids inner→outer and cross-module imports; eslint boundaries; naming lint). A repo-root `AGENTS.md` (universal) and `CLAUDE.md` (Claude Code specific) encode the rules, the exact commands, and "where do I add a new use case." Scaffolding is deterministic (plop / Nest schematics) so any agent emits an identical, correct slice from one command.
2. **There is a first-class AI Agent bounded context** (`modules/ai-agent/`) for LLM features — `Agent`, `Conversation`, `Message`, `Tool`, `PromptTemplate` as domain building blocks, plus `evals/` and `guardrails/`. The LLM SDK (`@anthropic-ai/sdk`, default model `claude-sonnet-4-6`) is **always an adapter behind a port** (`LlmPort` ← `ClaudeLlmAdapter`); domain and application layers never import the SDK.

## File Map

Read top-to-bottom for a full bootstrap; jump directly for a targeted task.

| File | What it covers | When to read |
| --- | --- | --- |
| [README.md](./README.md) | This index: purpose, file map, usage flows, and the step-by-step agent walkthrough | Start here / orientation |
| [00-system-prompt.md](./00-system-prompt.md) | Master generator prompt that drives a full bootstrap | Feed first when creating a new project |
| [01-architecture-principles.md](./01-architecture-principles.md) | Four layers, inward dependency rule, Result vs. throw, YAGNI | Before any design decision |
| [02-folder-structure.md](./02-folder-structure.md) | Repo tree, `modules/<context>/` slices, `libs/` shared kernel | When laying out or auditing folders |
| [03-domain-layer.md](./03-domain-layer.md) | Entity, AggregateRoot, ValueObject, domain events/errors/services | When modeling the innermost layer |
| [04-application-layer.md](./04-application-layer.md) | Commands, queries, handlers, ports, DTOs, event handlers | When writing a use case |
| [05-infrastructure-layer.md](./05-infrastructure-layer.md) | Repositories, persistence models, mappers, adapters | When wiring persistence or external systems |
| [06-interface-layer.md](./06-interface-layer.md) | HTTP/CLI/message controllers, request/response DTOs, Result→HTTP | When exposing a slice to the outside |
| [07-cross-cutting.md](./07-cross-cutting.md) | Config, logging, exception filter, DI tokens, transactions | When adding cross-cutting concerns |
| [08-ai-agent-first.md](./08-ai-agent-first.md) | `AGENTS.md`/`CLAUDE.md`, guardrails in CI, the `ai-agent` context, `LlmPort` | When enabling agent ergonomics or LLM features |
| [09-testing-strategy.md](./09-testing-strategy.md) | Jest unit/integration, Cucumber/Gherkin + supertest e2e | When adding or reviewing tests |
| [10-module-scaffold-prompt.md](./10-module-scaffold-prompt.md) | The drop-in prompt to generate one vertical slice | Every time you add a feature |
| [11-example-output.md](./11-example-output.md) | A full worked example slice (anchors depth and tone) | When you need a concrete reference |
| [12-implementation-checklist.md](./12-implementation-checklist.md) | Ordered checklist to scaffold and verify the repo | Before declaring a milestone done |
| [13-harness-engineering.md](./13-harness-engineering.md) | The session harness: `feature_list.json`, `init.sh`, session handoff, clean-state checklist, benchmark/cleanup scripts. NestJS binding of the standalone [`../init-harness/`](../init-harness/) set | When setting up or auditing multi-session agent work |
| [14-design-first.md](./14-design-first.md) | Tactical design before code: SRS + per-context design docs, the invariant-enforcement table (DB constraints + proof tests), contract-only cross-context rule, generated truth docs. NestJS binding of [`../init-harness/06-design-first.md`](../init-harness/06-design-first.md) | Before a new context, aggregate, invariant, or cross-context contract |

## Usage Flow 1 — Bootstrap a Brand-New Project

1. Give the agent [00-system-prompt.md](./00-system-prompt.md) as the master instruction.
2. Attach the layer docs it needs as context: [01-architecture-principles.md](./01-architecture-principles.md), [02-folder-structure.md](./02-folder-structure.md), then the relevant [03-domain-layer.md](./03-domain-layer.md) → [06-interface-layer.md](./06-interface-layer.md), plus [07-cross-cutting.md](./07-cross-cutting.md) and [09-testing-strategy.md](./09-testing-strategy.md).
3. If the product needs LLM features, also attach [08-ai-agent-first.md](./08-ai-agent-first.md). For multi-session agent work, attach [13-harness-engineering.md](./13-harness-engineering.md). For anything beyond a trivial domain, attach [14-design-first.md](./14-design-first.md) and write the SRS + context design docs (with the invariant-enforcement table) **before** approving the scaffold plan.
4. State your bounded contexts and first use case; let the agent generate the tree, `libs/` shared kernel, `AGENTS.md`/`CLAUDE.md`, CI guardrails, and the session harness (`feature_list.json`, `init.sh`, handoff/checklist files).
5. Verify against [12-implementation-checklist.md](./12-implementation-checklist.md). Use [11-example-output.md](./11-example-output.md) as the depth/tone benchmark.

```bash
# the agent should end up able to run, at minimum:
pnpm install
pnpm build
pnpm test            # jest unit + integration
pnpm test:e2e        # cucumber/gherkin + supertest
pnpm lint            # eslint boundaries + naming lint
pnpm arch            # dependency-cruiser: no inner->outer, no cross-module
pnpm plop            # plop / nest schematics: generate a vertical slice
```

## Usage Flow 2 — Add a Feature to an Existing Project

1. Give the agent [10-module-scaffold-prompt.md](./10-module-scaffold-prompt.md) — the deterministic slice generator.
2. Provide the bounded context, the use case (command **or** query), and the entities/value objects involved. If the feature is design-tier (new aggregate, new invariant, new cross-context contract — [14-design-first.md](./14-design-first.md) §tiers), the context design doc must exist and be approved first; a standard CRUD slice uses the filled input contract of `10` as its mini design doc.
3. The agent generates a single vertical slice under `modules/<context>/commands/<use-case>/` or `queries/<use-case>/`: command/query + handler, controllers, request/response DTOs, ports, repository wiring, and tests — following Common Closure (files that change together live together).
4. Remember the orchestration rule: **Command → Event → Command**, never command-calls-command directly; cross-module communication goes through the command/query bus or events only.
5. Confirm guardrails still pass (`pnpm arch && pnpm lint`) and the relevant items in [12-implementation-checklist.md](./12-implementation-checklist.md).
6. Keep the harness honest per [13-harness-engineering.md](./13-harness-engineering.md): the slice's `feature_list.json` entry moves to `"pass"` only with runtime evidence; update `session-handoff.md` when the session ends.

For deeper questions during the task, cross-reference the matching layer doc ([03-domain-layer.md](./03-domain-layer.md) … [07-cross-cutting.md](./07-cross-cutting.md)) rather than improvising.

## Walkthrough — Bootstrap a Project Using an AI Coding Agent

This is the concrete, hands-on version of Usage Flow 1. It uses **Claude Code** as the example agent, but any capable coding agent (Cursor, Windsurf, etc.) works the same way — the prompt set is the spec, the agent is the executor. It also shows how to stand up a project that **ships its own AI-agent feature** (the `ai-agent` bounded context), so "AI agent" appears twice here: the agent that *builds* the repo, and the agent feature that *lives in* the repo.

### Step 0 — Prerequisites

- An AI coding agent running **inside an empty git repo** (e.g. `claude` in a fresh folder).
- **Node 22 LTS** + **pnpm** installed (the agent will scaffold NestJS 11 — see [12-implementation-checklist.md](./12-implementation-checklist.md)).
- This `init-nestjs-hexagonal/` folder reachable by the agent: copy it into the repo (e.g. `docs/spec/`), or paste the relevant files as context. The agent must be able to **read** these files.

### Step 1 — Make the prompt set the agent's source of truth

Tell the agent the spec exists and must be followed verbatim:

> Read every file in `docs/spec/` (the `init-nestjs-hexagonal` prompt set). Treat `00-system-prompt.md` as your system prompt and `01`–`09` as the binding conventions. Do not invent patterns that contradict them.

### Step 2 — Kick off with one prompt (copy-paste, fill the blanks)

```text
You are bootstrapping a new NestJS backend. The folder docs/spec/ is your specification —
treat it as authoritative.

1. Adopt docs/spec/00-system-prompt.md as your system prompt. Apply the rules in
   01-architecture-principles.md + 02-folder-structure.md, the layer guides 03–07, and
   08-ai-agent-first.md for the AI-agent context and CI guardrails.
2. Product idea: <one paragraph: what the backend does and for whom>.
   - Bounded contexts (guess if unsure): <e.g. users, billing, ai-assistant>
   - Persistence: <Slonik | TypeORM | Prisma | you choose and justify>
   - Transports: <http | +graphql | +cli | +message>
   - AI features in scope: <yes/no — chat, tool-calling, RAG, autonomous agent>
3. Follow the "Handling missing information" rule: infer reasonable assumptions and state them;
   ask me AT MOST 1–2 questions, and only if the answer changes the architecture.
4. Then output the 9-section scaffold from 00-system-prompt.md (Assumptions → Bounded Contexts →
   Folder Tree → … → Implementation Checklist). STOP there and wait for my approval before
   writing files.
```

### Step 3 — Review the plan, then let it build

The agent returns the 9-section plan. **Review it before any file is written** — check the bounded contexts, the persistence choice, and whether an `ai-agent` context is included if you asked for AI features. Correct anything, then approve:

> Plan approved. Now generate the actual files in this order, pinning **NestJS 11 / Node 22** per `12-implementation-checklist.md`:
> 1. the `libs/` shared kernel (base classes, exceptions, ports, `guard.ts`);
> 2. `AGENTS.md` + `CLAUDE.md` at the repo root, `.dependency-cruiser.cjs`, `plopfile.cjs`;
> 3. the first vertical slice end-to-end (domain → application → infrastructure → interface) with its tests;
> 4. `package.json` scripts (`build`, `test`, `test:e2e`, `lint`, `arch`, `plop`, `migrate`) and `.env.example`.
> After each group, run `pnpm install` / `pnpm arch` / `pnpm lint` and fix what they report.

### Step 4 — Verify the bootstrap

The repo should now build and pass its own guardrails. Run the gate from [12-implementation-checklist.md](./12-implementation-checklist.md):

```bash
pnpm install
pnpm build
pnpm arch            # dependency-cruiser: no inner->outer, no cross-module imports
pnpm lint            # eslint boundaries + naming lint
pnpm test            # jest unit + integration
```

Use [11-example-output.md](./11-example-output.md) as the depth/tone benchmark: if the agent's first slice is materially thinner or breaks a convention, point it back at the relevant `03`–`08` file and have it self-correct. From here, `AGENTS.md` / `CLAUDE.md` are the agent's standing brief — it reads them at the start of every later task.

### Step 5 — Add the AI-agent feature (the `ai-agent` context)

If your product ships an LLM feature, have the agent create the first-class `modules/ai-agent/` context per [08-ai-agent-first.md](./08-ai-agent-first.md):

> Add the `ai-agent` bounded context from `docs/spec/08-ai-agent-first.md` Half B: the domain
> (`Agent`, `Conversation`, `Message`, `Tool`, `PromptTemplate`), `LlmPort`, and `ClaudeLlmAdapter`
> (`@anthropic-ai/sdk`, default model `claude-sonnet-4-6`). The LLM stays **behind the port** — domain
> and application must never import the SDK; `pnpm arch` enforces this. Add a `start-conversation`
> command slice and a unit test that mocks `LlmPort`.

Set `ANTHROPIC_API_KEY` in `.env` (key only — never commit it; see [07-cross-cutting.md](./07-cross-cutting.md)). [11-example-output.md](./11-example-output.md) is a full worked example of exactly this slice.

### Step 6 — Grow the codebase, one slice per task

For every subsequent feature, drive the agent with [10-module-scaffold-prompt.md](./10-module-scaffold-prompt.md) (fill its input contract) or run `pnpm plop slice -- --context <ctx> --name <verb-noun>` and let the agent fill the bodies. Keep each task to **one bounded context**; cross-context work goes through events (**Command → Event → Command**), never a direct import.

### Worked kickoff — a support backend that uses Claude

A filled-in Step 2 for an AI-enabled product:

```text
2. Product idea: a customer-support backend. Staff and end-users open conversations; an AI
   assistant drafts replies from our knowledge base and can call a `lookup_order` tool. Staff
   can escalate a conversation to a human.
   - Bounded contexts: support (conversations, escalation) + ai-agent (LLM, tools, prompts)
   - Persistence: Slonik
   - Transports: http
   - AI features in scope: yes — chat + tool-calling, Claude via LlmPort (default claude-sonnet-4-6)
```

### Keeping the agent on-rails

- **The guardrails are the contract.** `pnpm arch` (dependency-cruiser) fails the build on inner→outer and cross-module imports; run it after every change so a wrong guess never lands.
- **`AGENTS.md` / `CLAUDE.md` over chat memory.** If a rule keeps getting missed, fix it in `AGENTS.md` (the agent re-reads it each task), not in a one-off message.
- **Evidence before "done".** The session harness ([13-harness-engineering.md](./13-harness-engineering.md)) makes "it works" a checkable claim: `feature_list.json` status changes require runtime evidence, `bash init.sh` verifies every resume, and `session-handoff.md` keeps multi-session work restartable.
- **Scaffold, don't free-hand.** Prefer `pnpm plop slice` so every slice is identical and correct; the agent only fills the handler/domain bodies.
- **The LLM is always an adapter.** Any `@anthropic-ai/sdk` import outside a `*.adapter.ts` is a layering violation — the SDK lives only in `ClaudeLlmAdapter` behind `LlmPort`.

## Stack Summary

| Concern | Choice |
| --- | --- |
| Runtime / versions | **NestJS 11** (Express 5 default) · **Node 22 LTS** (≥ 20) · TypeScript 5.7+ |
| Framework / language | NestJS + TypeScript |
| CQRS | `@nestjs/cqrs` ^11 (`CommandBus`, `QueryBus`, `ICommandHandler`, `IQueryHandler`) |
| Domain events | `EventBus` / `@nestjs/event-emitter` |
| Validation | `class-validator` + `class-transformer` (in DTOs) |
| Persistence | SQL — **Slonik** (raw SQL, preferred for complex domains) or **TypeORM/Prisma** (simpler ones) |
| Result type | `oxide.ts` (`Ok`/`Err`, `Result<T, E>`) or `@badrap/result` |
| Testing | Jest (unit + integration); Cucumber/Gherkin + supertest (acceptance/e2e) |
| Architecture enforcement | dependency-cruiser + eslint boundaries + naming lint |
| Scaffolding | plop / Nest schematics |
| Config | `@nestjs/config` + zod/joi validation |
| LLM provider | `@anthropic-ai/sdk` (Anthropic Claude), default model `claude-sonnet-4-6`, behind `LlmPort` |

**Four layers, dependencies point inward:** Interface Adapters (outermost) → Application → Domain (innermost). Infrastructure sits on the outer ring implementing Application ports. The Domain layer has **zero** framework/IO/SDK dependencies; time and random ids are injected, never read directly. Business/domain errors are **returned** as `Result<T, E>`; technical failures are **thrown** and mapped by a global exception filter.

**Upstream reference:** [Sairyss/domain-driven-hexagon](https://github.com/Sairyss/domain-driven-hexagon) — read it for the full rationale behind these patterns. This prompt set adapts that architecture to be agent-consumable. Version targets and the full pinned dependency list live in [12-implementation-checklist.md](./12-implementation-checklist.md); the layout is forward-compatible with the NestJS 12 roadmap (ESM, Standard Schema, Vitest), which migrates additively.

## A Note on Naming and Idioms

File-naming conventions and idioms in this set (e.g. `user.entity.ts`, `create-user.command.ts`, `create-user.service.ts`, `user.repository.ts`, `*.http.controller.ts`, `claude-llm.adapter.ts`) are the **defaults**, and they are **configurable** — the value is consistency, not the specific suffixes. If you change them, change them in **one place**: the file-naming map inside `AGENTS.md`/`CLAUDE.md` (see [08-ai-agent-first.md](./08-ai-agent-first.md)) and the scaffold templates (see [10-module-scaffold-prompt.md](./10-module-scaffold-prompt.md)), then let the naming lint enforce the new convention. Directories stay kebab-case regardless.

## Output-Scaling Reminder

The fullest layout in these docs is a **ceiling, not a mandate**. Adapt depth to project size: small services skip ports/value-objects that earn nothing and may collapse layers; enterprise contexts use the full structure plus evals, guardrails, and observability. Do not over-engineer a small project — apply YAGNI and add structure only where it pays for itself.

# Prompt Set: Initialize an AI-Agent-First React SPA (Vite · shadcn · Orval · PWA)

This folder is a **reusable prompt set** that an AI coding agent (Claude Code, Cursor, etc.)
consumes to bootstrap and extend a production-grade frontend using **Vite 8 + React 19 +
TypeScript**, Tailwind CSS v4 + shadcn/ui, an **Orval-generated TanStack Query v5 data layer from
`openapi.json`**, Google sign-in via `@react-oauth/google`, react-i18next, and vite-plugin-pwa.
It is the frontend sibling of [`../init-nestjs-hexagonal/`](../init-nestjs-hexagonal/README.md)
(whose NestJS backend emits the `openapi.json` this set consumes).

These are spec/prompt documents — not runnable code. You feed the relevant files to an agent as
context; the agent generates the repository, a feature slice, or a fix that conforms to the rules.

## What "AI-Agent-First" Means Here

Two distinct ideas, both load-bearing:

1. **The codebase is designed so AI agents and humans extend it safely.** Ring + dependency rules
   are explicit (`app → features → kernel/api`, no cross-feature imports, generated code is
   read-only), file naming is deterministic, and guardrails run in CI (eslint-plugin-boundaries,
   `check-architecture.sh`, generated-layer freshness diff). A repo-root `AGENTS.md` (universal)
   and `CLAUDE.md` (Claude Code specific) encode the rules and exact commands. Scaffolding is
   deterministic (plop) so any agent emits an identical, correct feature slice from one command.
2. **The project ships a full session harness** (adapted from
   [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering)):
   `feature_list.json` (status + evidence), `init.sh` (resume verification), `session-handoff.md`,
   `claude-progress.md`, `clean-state-checklist.md`, and benchmark/cleanup scripts — so
   long-running, multi-session agent work stays in scope, verifiable, and restartable.

## File Map

Read top-to-bottom for a full bootstrap; jump directly for a targeted task.

| File | What it covers | When to read |
| --- | --- | --- |
| [README.md](./README.md) | This index: purpose, file map, usage flows, walkthrough | Start here / orientation |
| [00-system-prompt.md](./00-system-prompt.md) | Master generator prompt that drives a full bootstrap | Feed first when creating a new project |
| [01-architecture-principles.md](./01-architecture-principles.md) | Four rings, inward dependency rule, server-vs-client state, YAGNI | Before any design decision |
| [02-folder-structure.md](./02-folder-structure.md) | Repo tree, `features/<name>/` slices, kernel, naming map | When laying out or auditing folders |
| [03-ui-layer.md](./03-ui-layer.md) | Tailwind v4 CSS-first, shadcn/ui, forms (RHF+zod), three states | When building UI |
| [04-data-layer.md](./04-data-layer.md) | Orval config, the mutator (auth/refresh), TanStack Query v5 conventions | When touching anything server-state |
| [05-auth-google.md](./05-auth-google.md) | Google flows (credential vs auth-code), session models, guards | When wiring auth |
| [06-i18n.md](./06-i18n.md) | react-i18next namespaces, lazy loading, type-safe keys | When adding languages/strings |
| [07-pwa.md](./07-pwa.md) | vite-plugin-pwa: generateSW, API NetworkOnly, update prompt | When enabling installable/offline |
| [08-ai-agent-first.md](./08-ai-agent-first.md) | `AGENTS.md`/`CLAUDE.md`, ESLint boundaries, CI guardrails, plop | When enabling agent ergonomics |
| [09-testing-strategy.md](./09-testing-strategy.md) | Vitest + RTL + MSW (network-level), Playwright e2e | When adding or reviewing tests |
| [10-feature-scaffold-prompt.md](./10-feature-scaffold-prompt.md) | The drop-in prompt to generate one feature slice | Every time you add a feature |
| [11-example-output.md](./11-example-output.md) | A full worked `invoices` slice (anchors depth and tone) | When you need a concrete reference |
| [12-implementation-checklist.md](./12-implementation-checklist.md) | Ordered phases to scaffold and verify the repo | Before declaring a milestone done |
| [13-harness-engineering.md](./13-harness-engineering.md) | The five harness subsystems: feature_list.json, init.sh, handoff, checklists, scripts. React binding of the standalone [`../init-harness/`](../init-harness/) set | When setting up or auditing the session harness |
| [14-design-first.md](./14-design-first.md) | Design before code: the bootstrap brief, per-slice design docs (UX flow, URL state, data/invalidation map, interaction state machine), the UI Foundation, the visual polish pass. React binding of [`../init-harness/06-design-first.md`](../init-harness/06-design-first.md) | Before the bootstrap brief; before any design-tier slice |

## Usage Flow 1 — Bootstrap a Brand-New Project

1. Give the agent [00-system-prompt.md](./00-system-prompt.md) as the master instruction.
2. Attach the docs it needs as context: [01](./01-architecture-principles.md) + [02](./02-folder-structure.md),
   then the relevant layer guides [03](./03-ui-layer.md)–[07](./07-pwa.md), plus
   [08](./08-ai-agent-first.md), [09](./09-testing-strategy.md), and [13](./13-harness-engineering.md).
3. Provide the product idea, the `openapi.json` (or where to get it), auth model, languages, and
   whether PWA is in scope — ideally as the Level-1 bootstrap brief from
   [14-design-first.md](./14-design-first.md) §1, which also surfaces contract gaps before any
   code exists.
4. The agent outputs the 9-section scaffold plan; review it, then let it generate files.
5. Verify against [12-implementation-checklist.md](./12-implementation-checklist.md);
   use [11-example-output.md](./11-example-output.md) as the depth/tone benchmark.

```bash
# the agent should end up able to run, at minimum:
pnpm install
pnpm generate:api    # openapi.json → src/api/generated (Orval)
pnpm check           # tsc --noEmit
pnpm lint            # eslint boundaries + naming
pnpm arch            # scripts/check-architecture.sh
pnpm test            # vitest + RTL + MSW
pnpm test:e2e        # playwright
pnpm build && pnpm preview
pnpm plop feature -- --name <name>   # deterministic slice scaffold
bash init.sh         # full resume verification (13-harness-engineering.md)
```

## Usage Flow 2 — Add a Feature to an Existing Project

1. Give the agent [10-feature-scaffold-prompt.md](./10-feature-scaffold-prompt.md) with its input
   contract filled (feature, routes, generated hooks, form fields, guard, namespace).
2. The agent scaffolds/fills one slice under `src/features/<name>/`, wires the route, locales,
   MSW handlers, and tests — following Common Closure (files that change together live together).
3. Remember the boundary rules: no cross-feature imports; generated API code is read-only
   (spec change → `pnpm generate:api`); server state only in the query cache.
4. Confirm guardrails pass (`pnpm arch && pnpm lint && pnpm test`) and the harness is updated
   (`feature_list.json` evidence, handoff) per [13-harness-engineering.md](./13-harness-engineering.md).

For deeper questions during the task, cross-reference the matching layer doc
([03](./03-ui-layer.md)–[07](./07-pwa.md)) rather than improvising.

## Walkthrough — Bootstrap with an AI Coding Agent

### Step 0 — Prerequisites

- An AI coding agent running **inside an empty git repo**.
- **Node 22 LTS (≥ 22.18** — Orval 8's floor**)** + **pnpm** installed.
- The backend's `openapi.json` reachable (file, URL, or the NestJS sibling's Swagger export).
- This `init-react/` folder reachable by the agent: copy it into the repo (e.g. `docs/spec/`).

### Step 1 — Make the prompt set the agent's source of truth

> Read every file in `docs/spec/` (the `init-react` prompt set). Treat `00-system-prompt.md` as
> your system prompt and `01`–`09` + `13`–`14` as the binding conventions. Do not invent patterns
> that contradict them.

### Step 2 — Kick off with one prompt (copy-paste, fill the blanks)

```text
You are bootstrapping a new React SPA. The folder docs/spec/ is your specification —
treat it as authoritative.

1. Adopt docs/spec/00-system-prompt.md as your system prompt. Apply 01+02, the layer guides
   03–07, 08 for guardrails, 09 for tests, 13 for the harness, 14 design-first (before any
   design-tier slice).
2. Product idea: <one paragraph: what the app does and for whom>.
   - openapi.json: <path/URL | "none yet — use the 04 §6 fallback">
   - Auth: <Google credential flow + cookie session | bearer+refresh | none>
   - Languages: <e.g. en, vi>       - PWA: <yes/no + why>
3. Follow the "Handling missing information" rule: infer and state assumptions;
   ask me AT MOST 1–2 questions, only if the answer changes the architecture.
4. Then output the 9-section scaffold from 00-system-prompt.md. STOP and wait for my
   approval before writing files.
```

### Step 3 — Review the plan, then let it build

Check the feature table (it seeds `feature_list.json`), the auth model, and the PWA decision.
Then approve:

> Plan approved. Generate in this order, per `12-implementation-checklist.md`:
> (1) Phase 1–2 foundation (Vite 8, TS strict, Tailwind v4, shadcn init);
> (2) Phase 3 data layer (mutator + orval.config + `pnpm generate:api`);
> (3) Phase 4 app shell; (4) **Phase 5 harness + guardrails BEFORE any feature**;
> (5) Phase 6 auth + i18n; (6) Phase 8–9 first slice + tests.
> After each phase, run the phase's gates and fix what they report.

### Step 4 — Verify the bootstrap

```bash
bash init.sh          # install → generated-layer freshness → check → lint → arch → test → build
pnpm dev              # manual: routes render, sign-in works, language switches
```

Use [11-example-output.md](./11-example-output.md) as the benchmark: if the agent's first slice is
materially thinner or breaks a convention, point it back at the relevant file and have it
self-correct. From here, `AGENTS.md`/`CLAUDE.md` + the harness files are the agent's standing
brief — it reads them at the start of every later session.

### Step 5 — Grow the codebase, one slice per session

Drive each feature with [10-feature-scaffold-prompt.md](./10-feature-scaffold-prompt.md) or
`pnpm plop feature`. Keep each task to **one feature slice**; keep `feature_list.json` honest
(ONE in-progress, evidence before "pass"); end every session with the handoff + clean-state
checklist ([13](./13-harness-engineering.md) §8).

### Keeping the agent on-rails

- **The guardrails are the contract.** `pnpm arch` + boundaries lint fail the build on ring
  violations and generated-code edits; run them after every change so a wrong guess never lands.
- **`AGENTS.md` over chat memory.** A rule that keeps getting missed gets fixed in `AGENTS.md`,
  not repeated in prompts.
- **Scaffold, don't free-hand.** `pnpm plop feature` makes every slice identical; the agent fills
  bodies only.
- **The spec is the API.** Wrong/missing endpoint → change `openapi.json` (i.e. the backend),
  regenerate — never hand-write a request (sync process: 04 §7 — CI artifact or `contract:pull`;
  every contract gap gets an explicit block / stub / BE-change-request decision, 14 §1).
- **Evidence before "done".** The harness (13) makes "it works" a checkable claim, not a vibe.

## Stack Summary

| Concern | Choice |
| --- | --- |
| Runtime / versions | **Node 22 LTS (≥ 22.18)** · **Vite 8.1** (Rolldown/Oxc, ESM-only) · **@vitejs/plugin-react 6** · **React 19.2** · **TypeScript 5.9+/6.0** |
| Styling | **Tailwind CSS 4.3** — CSS-first (`@import "tailwindcss"` + `@theme`), `@tailwindcss/vite`, no JS config |
| UI primitives | **shadcn/ui** (CLI 4.x; repo-owned components under `components/ui/`), Radix, `cn()`, cva variants |
| Data layer | **Orval 8.20** → **TanStack Query 5** hooks from `openapi.json` (`tags-split`, `httpClient: 'axios'` + one mutator, opt-in Suspense hooks, optional Zod 4 output) |
| Auth | **@react-oauth/google 0.13** — credential (ID token) flow default, auth-code when backend needs Google APIs; session = httpOnly cookie or bearer+refresh in the mutator |
| Routing | React Router 7 (TanStack Router = legitimate swap, record in AGENTS.md) |
| i18n | **i18next 26 / react-i18next 17** + http-backend (lazy namespaces) + language detector + typed keys via module augmentation |
| PWA | **vite-plugin-pwa 1.3** — generateSW, `registerType: 'prompt'`, API = NetworkOnly |
| Forms | react-hook-form + zod (+ `@hookform/resolvers`), shadcn `form.tsx` |
| Testing | **Vitest 4** + Testing Library + **MSW 2** (network-level) · **Playwright** e2e |
| Architecture enforcement | ESLint 9 flat config + **eslint-plugin-boundaries** (7.x or pinned 6.x) + `no-restricted-imports` + `scripts/check-architecture.sh` |
| Scaffolding | plop (feature slices) + shadcn CLI (primitives) + Orval (API layer) |
| Harness | feature_list.json · init.sh · session-handoff · claude-progress · clean-state-checklist · benchmark/cleanup scripts (see 13) |

**Four rings, dependencies point inward:** `app/` (composition root) → `features/<name>/`
(vertical slices) → shared kernel (`components/`, `lib/`, `hooks/`) + `api/` (generated port +
one hand-written mutator adapter + `errors.ts`, the error seam). Features never import each
other; nothing imports `app/`;
generated code is never edited. Server state lives ONLY in the TanStack Query cache; client state
in React/small stores.

**Upstream references:** [bulletproof-react](https://github.com/alan2207/bulletproof-react)
(feature structure), [orval.dev](https://orval.dev) + [tanstack.com/query](https://tanstack.com/query)
(data layer), [ui.shadcn.com](https://ui.shadcn.com) + [tailwindcss.com](https://tailwindcss.com)
(UI), [vite-pwa-org.netlify.app](https://vite-pwa-org.netlify.app) (PWA),
[learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering) (harness).
Version targets live in [12-implementation-checklist.md](./12-implementation-checklist.md) Phase 0
— re-verify `latest` at init time; the ecosystem moves fast.

**Cross-set:** outcome catalogs and UI state matrices come from an approved use-case spec —
authored with [`../init-feature-spec/`](../init-feature-spec/README.md).

## A Note on Naming and Idioms

File-naming conventions in this set (kebab-case files, `use-*.ts`, `*.store.ts`, `*.schema.ts`,
`*-provider.tsx`, `*.test.tsx`) are the **defaults**, and they are **configurable** — the value is
consistency, not the specific patterns. If you change them, change them in **one place**: the
naming map in `AGENTS.md` (see `08-ai-agent-first.md`) and the plop templates, then let the naming
lint enforce the new convention. Directories stay kebab-case regardless; kebab-case component
files match what the shadcn CLI emits, which is why they are the default here.

## Output-Scaling Reminder

The fullest layout in these docs is a **ceiling, not a mandate**. Adapt depth to project size:
small tools skip stores, PWA, and most of the harness; enterprise apps use the full structure plus
`docs/`, rubrics, and benchmark budgets. Do not over-engineer a small project — apply YAGNI and
add structure only where it pays for itself.

# Prompt Set: Initialize an AI-Agent-First Next.js App (App Router · shadcn · Orval · Auth.js · next-intl)

This folder is a **reusable prompt set** that an AI coding agent (Claude Code, Cursor, etc.)
consumes to bootstrap and extend a production-grade frontend using **Next.js 16 (App Router) +
React 19 + TypeScript**, Tailwind CSS v4 + shadcn/ui, an **Orval-generated data layer from
`openapi.json`** (isomorphic fetch functions + TanStack Query v5 with server prefetch +
hydration), Google sign-in via **Auth.js (next-auth v5)**, and **next-intl**. It is the
server-rendered sibling of [`../init-react/`](../init-react/README.md) (the Vite SPA set) and
the frontend counterpart of [`../init-nestjs-hexagonal/`](../init-nestjs-hexagonal/README.md)
(whose NestJS backend emits the `openapi.json` this set consumes).

These are spec/prompt documents — not runnable code. You feed the relevant files to an agent as
context; the agent generates the repository, a feature slice, or a fix that conforms to the rules.

## When to use this set (vs `init-react`)

| Pick | When |
| --- | --- |
| **init-nextjs** (this set) | Public-facing product where SEO/first-paint matter (users arrive via links/search), mixed public + authenticated surface, or you want server-side auth handshakes and per-segment rendering control |
| **init-react** | Pure internal tool / dashboard behind a login, no SEO surface, simplest possible hosting (static files + API), or PWA/offline is a hard requirement |

Same rings, same contract seam (`mapApiError`), same harness — a team can run both sets against
one backend without relearning the rules.

## What "AI-Agent-First" Means Here

Two distinct ideas, both load-bearing:

1. **The codebase is designed so AI agents and humans extend it safely.** Ring + dependency rules
   are explicit (`app → features → kernel/api`, no cross-feature imports, generated code is
   read-only) PLUS the server/client boundary rules (Server Components by default,
   `server-only`/`client-only` markers, no secrets in `NEXT_PUBLIC_*`), file naming is
   deterministic, and guardrails run in CI (eslint-plugin-boundaries, `check-architecture.sh`,
   generated-layer freshness diff, the build itself as a boundary gate). A repo-root `AGENTS.md`
   (universal) and `CLAUDE.md` (Claude Code specific) encode the rules and exact commands.
   Scaffolding is deterministic (plop) so any agent emits an identical, correct feature slice
   from one command.
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
| [01-architecture-principles.md](./01-architecture-principles.md) | Four rings, inward dependency rule, server/client boundary, server-vs-client state, YAGNI | Before any design decision |
| [02-folder-structure.md](./02-folder-structure.md) | Repo tree, route groups + thin segments, `features/<name>/` slices, kernel, naming map | When laying out or auditing folders |
| [03-ui-layer.md](./03-ui-layer.md) | Tailwind v4 CSS-first (PostCSS), shadcn/ui, next/font+image, forms (RHF+zod), three states | When building UI |
| [04-data-layer.md](./04-data-layer.md) | Orval config (fetch client), the isomorphic mutator, prefetch+hydration, Server Actions policy | When touching anything server-state |
| [05-auth-google.md](./05-auth-google.md) | Auth.js v5 Google flow, session-owner models, guards (proxy + layout + backend) | When wiring auth |
| [06-i18n.md](./06-i18n.md) | next-intl routing/request/navigation, namespaces, typed keys, localized metadata | When adding languages/strings |
| [07-rendering-caching.md](./07-rendering-caching.md) | Per-segment rendering modes, one-cache-owner rule, revalidation, streaming, SEO surface | For EVERY new segment; replaces the SPA set's PWA chapter |
| [08-ai-agent-first.md](./08-ai-agent-first.md) | `AGENTS.md`/`CLAUDE.md`, ESLint boundaries, build-time boundary gates, CI guardrails, plop | When enabling agent ergonomics |
| [09-testing-strategy.md](./09-testing-strategy.md) | Vitest + RTL + MSW on the client tree; Playwright owning the server half (RSC, guards, SEO) | When adding or reviewing tests |
| [10-feature-scaffold-prompt.md](./10-feature-scaffold-prompt.md) | The drop-in prompt to generate one feature slice (INPUT CONTRACT incl. rendering + outcomes) | Every time you add a feature |
| [11-example-output.md](./11-example-output.md) | A full worked `events` slice — thin page + hydrated client tree (anchors depth and tone) | When you need a concrete reference |
| [12-implementation-checklist.md](./12-implementation-checklist.md) | Ordered phases to scaffold and verify the repo | Before declaring a milestone done |
| [13-harness-engineering.md](./13-harness-engineering.md) | Slot table + the five harness subsystems: feature_list.json, init.sh, handoff, checklists, scripts. Next.js binding of the standalone [`../init-harness/`](../init-harness/) set | When setting up or auditing the session harness |
| [14-design-first.md](./14-design-first.md) | Design before code: the bootstrap brief, per-slice design docs (UX flow, URL state, rendering/caching, data/invalidation map, interaction state machine), the UI Foundation, the visual polish pass. Next.js binding of [`../init-harness/06-design-first.md`](../init-harness/06-design-first.md) | Before the bootstrap brief; before any design-tier slice |

Role coverage note (per [`../stack-set-template.md`](../README.md#upstream-only-docs) §2): files 03–07
are this stack's subsystem guides — UI, data, auth, i18n, and **rendering/caching** (the
platform slot; PWA/offline is deliberately N/A by default, `07-rendering-caching.md` §6).

## Lite Path — the ~18 KB that governs (small projects, human reviewers)

This set is ~215 KB; agents reach the rest through the File Map per task. A small project, or
a human reviewing agent work against this set, reads only:

1. [00-system-prompt.md §Core Principles](./00-system-prompt.md#core-principles) — the
   non-negotiable rules, one bullet each.
2. [12-implementation-checklist.md](./12-implementation-checklist.md) — what "conforms" means,
   as checkable boxes.
3. [13-harness-engineering.md](./13-harness-engineering.md) — only its slot table, when a harness
   is in play.

The Lite Path **points, never restates**: there is no digest file to drift. If a rule a reviewer
needs is missing from Core Principles or the checklist, fix it there (upstream), not in a summary.

## Usage Flow 1 — Bootstrap a Brand-New Project

1. Give the agent [00-system-prompt.md](./00-system-prompt.md) as the master instruction.
2. Attach the docs it needs as context: [01](./01-architecture-principles.md) + [02](./02-folder-structure.md),
   then the relevant layer guides [03](./03-ui-layer.md)–[07](./07-rendering-caching.md), plus
   [08](./08-ai-agent-first.md), [09](./09-testing-strategy.md), and [13](./13-harness-engineering.md).
3. Provide the product idea, the `openapi.json` (or where to get it), the session-owner model,
   languages, and which pages must be public/indexable — ideally as the Level-1 bootstrap brief
   from [14-design-first.md](./14-design-first.md) §1, which also surfaces contract gaps before
   any code exists.
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
pnpm test:e2e        # playwright (server half: RSC, guards, SEO, rendering modes)
pnpm build && pnpm start   # route table = rendering truth
pnpm plop feature -- --name <name>   # deterministic slice scaffold
bash init.sh         # full resume verification (13-harness-engineering.md)
```

## Usage Flow 1b — Add a Next.js App to an Existing Contract Monorepo

When the repo already runs [`../init-monorepo-contract/`](../init-monorepo-contract/README.md)
(root harness + `packages/contract/openapi.json` + other apps), do NOT run Flow 1 as written:
feed [00-system-prompt.md](./00-system-prompt.md) §Monorepo mode plus
[`../init-monorepo-contract/01-workspace-structure.md`](../init-monorepo-contract/01-workspace-structure.md)
§4b. The app lands in `apps/<name>/`, reads the shared contract, keeps an architecture-only
`AGENTS.md`, and plugs into the ROOT gates, `init.sh`, CI and ledger — one harness per repo.

## Usage Flow 2 — Add a Feature to an Existing Project

1. Give the agent [10-feature-scaffold-prompt.md](./10-feature-scaffold-prompt.md) with its input
   contract filled (feature, segments + rendering, generated operations, outcomes, form fields,
   guard, namespace).
2. The agent scaffolds/fills one slice under `src/features/<name>/` + its thin segment folder,
   wires locales, MSW handlers, and tests — following Common Closure (files that change together
   live together).
3. Remember the boundary rules: no cross-feature imports; generated API code is read-only
   (spec change → `pnpm generate:api`); one cache owner per surface; pages stay Server Components.
4. Confirm guardrails pass (`pnpm arch && pnpm lint && pnpm test`, plus the build route table)
   and the harness is updated (`feature_list.json` evidence, handoff) per
   [13-harness-engineering.md](./13-harness-engineering.md).

For deeper questions during the task, cross-reference the matching layer doc
([03](./03-ui-layer.md)–[07](./07-rendering-caching.md)) rather than improvising.

## Walkthrough — Bootstrap with an AI Coding Agent

### Step 0 — Prerequisites

- An AI coding agent running **inside an empty git repo**.
- **Node 22 LTS (≥ 22.18** — Orval 8's floor**)** + **pnpm** installed.
- The backend's `openapi.json` reachable (file, URL, or the NestJS sibling's Swagger export).
- This `init-nextjs/` folder reachable by the agent: copy it into the repo (e.g. `docs/spec/`).

### Step 1 — Make the prompt set the agent's source of truth

> Read every file in `docs/spec/` (the `init-nextjs` prompt set). Treat `00-system-prompt.md` as
> your system prompt and `01`–`09` + `13`–`14` as the binding conventions. Do not invent patterns
> that contradict them.

### Step 2 — Kick off with one prompt (copy-paste, fill the blanks)

```text
You are bootstrapping a new Next.js App Router frontend. The folder docs/spec/ is your
specification — treat it as authoritative.

1. Adopt docs/spec/00-system-prompt.md as your system prompt. Apply 01+02, the layer guides
   03–07, 08 for guardrails, 09 for tests, 13 for the harness, 14 design-first (before any
   design-tier slice).
2. Product idea: <one paragraph: what the app does and for whom>.
   - openapi.json: <path/URL | "none yet — use the 04 §6 fallback">
   - Session owner: <backend cookie (model A) | Auth.js JWT (model B) | none>
   - Languages: <e.g. vi, en>       - Public/indexable pages: <which, or "none — all authenticated">
3. Follow the "Handling missing information" rule: infer and state assumptions;
   ask me AT MOST 1–2 questions, only if the answer changes the architecture.
4. Then output the 9-section scaffold from 00-system-prompt.md. STOP and wait for my
   approval before writing files.
```

### Step 3 — Review the plan, then let it build

Check the feature table (it seeds `feature_list.json`), the session-owner model, and the
per-segment rendering column. Then approve:

> Plan approved. Generate in this order, per `12-implementation-checklist.md`:
> (1) Phase 1–2 foundation (Next 16, TS strict, Tailwind v4, shadcn init);
> (2) Phase 3 data layer (mutator + orval.config + `pnpm generate:api`);
> (3) Phase 4 app shell + route groups; (4) **Phase 5 harness + guardrails BEFORE any feature**;
> (5) Phase 6 auth + i18n; (6) Phase 7 rendering/SEO pass; (7) Phase 8–9 first slice + tests.
> After each phase, run the phase's gates and fix what they report.

### Step 4 — Verify the bootstrap

```bash
bash init.sh          # install → generated-layer freshness → check → lint → arch → test → build
pnpm dev              # manual: segments render, sign-in works, locale switches
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

- **The guardrails are the contract.** `pnpm arch` + boundaries lint fail on ring violations and
  generated-code edits; the BUILD fails on server/client boundary violations — run them after
  every change so a wrong guess never lands.
- **`AGENTS.md` over chat memory.** A rule that keeps getting missed gets fixed in `AGENTS.md`,
  not repeated in prompts.
- **Scaffold, don't free-hand.** `pnpm plop feature` makes every slice identical; the agent fills
  bodies only.
- **The spec is the API.** Wrong/missing endpoint → change `openapi.json` (i.e. the backend),
  regenerate — never hand-write a request (sync process: 04 §8 — CI artifact or `contract:pull`;
  every contract gap gets an explicit block / stub / BE-change-request decision, 14 §1).
- **The build route table is the rendering truth.** A rendering-mode claim without it is a vibe
  (07 §1, 13 §3).
- **Evidence before "done".** The harness (13) makes "it works" a checkable claim, not a vibe.

## Stack Summary

| Concern | Choice |
| --- | --- |
| Runtime / versions | **Node 22 LTS (≥ 22.18)** · **Next.js 16.x** (App Router, Turbopack) · **React 19.2** · **TypeScript 5.9+/6.0** |
| Styling | **Tailwind CSS 4.3** — CSS-first (`@import "tailwindcss"` + `@theme`), `@tailwindcss/postcss`, no JS config |
| UI primitives | **shadcn/ui** (CLI 4.x, `rsc: true`; repo-owned components under `components/ui/`), Radix, `cn()`, cva variants; `next/font` + `next/image` |
| Data layer | **Orval 8.20** → isomorphic fetch functions + **TanStack Query 5** hooks from `openapi.json` (`tags-split`, `httpClient: 'fetch'` + one mutator, server prefetch + `HydrationBoundary`, opt-in Suspense hooks, optional Zod output) |
| Auth | **Auth.js / next-auth v5** — server-side Google handshake; session owned by the NestJS backend (httpOnly cookie, model A) or Auth.js JWT (model B); guards = proxy (optimistic) + group layout (`auth()`) + backend enforcement |
| Routing | App Router: route groups `(public)`/`(app)` under `[locale]/`, thin pages, `loading.tsx`/`error.tsx` per segment |
| Rendering/caching | Per-segment decision (static / cached+tags / dynamic+streamed); mutator defaults `no-store`; ONE cache owner per surface; `revalidateTag` for public caches (07) |
| i18n | **next-intl 4** — `[locale]` routing, per-feature namespaces, server+client `t()`, typed keys, localized metadata |
| Forms | react-hook-form + zod (+ `@hookform/resolvers`), shadcn `form.tsx`; Server Actions only for server-only state (04 §7) |
| Testing | **Vitest 4** + Testing Library + **MSW 2** (client tree, network-level) · **Playwright** e2e (server half: RSC, guards, SEO, rendering modes) |
| Architecture enforcement | ESLint 9 flat config + **eslint-plugin-boundaries** + `no-restricted-imports` + `server-only`/`client-only` build gates + `scripts/check-architecture.sh` |
| Scaffolding | plop (feature slices + segment folders) + shadcn CLI (primitives) + Orval (API layer) |
| Harness | feature_list.json · init.sh · session-handoff · claude-progress · clean-state-checklist · benchmark/cleanup scripts (see 13) |

**Four rings, dependencies point inward:** `app/` (thin route segments) → `features/<name>/`
(vertical slices) → shared kernel (`components/`, `lib/`, `hooks/`) + `api/` (generated port +
one isomorphic mutator + `errors.ts`, the error seam). Features never import each other; nothing
imports `app/`; generated code is never edited. PLUS the boundary rule: Server Components by
default, `"use client"` at interactive leaves, secrets server-side only, one cache owner per
data surface.

**Upstream references:** [nextjs.org/docs](https://nextjs.org/docs) (App Router, caching),
[bulletproof-react](https://github.com/alan2207/bulletproof-react) (feature structure),
[orval.dev](https://orval.dev) + [tanstack.com/query](https://tanstack.com/query) (data layer +
SSR hydration), [authjs.dev](https://authjs.dev) (Auth.js v5), [next-intl.dev](https://next-intl.dev)
(i18n), [ui.shadcn.com](https://ui.shadcn.com) + [tailwindcss.com](https://tailwindcss.com) (UI),
[learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering) (harness).
Version targets live in [12-implementation-checklist.md](./12-implementation-checklist.md) Phase 0
— re-verify `latest` at init time; the ecosystem moves fast.

**Cross-set:** outcome catalogs and UI state matrices come from an approved use-case spec —
authored with [`../init-feature-spec/`](../init-feature-spec/README.md). Contract sync across
repos: [`../init-monorepo-contract/`](../init-monorepo-contract/README.md).

## A Note on Naming and Idioms

App Router reserved names (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`,
`proxy.ts`) are the framework's and not configurable. Everything else in this set (kebab-case
files, `use-*.ts`, `*.schema.ts`, `*.store.ts`, `*.test.tsx`) is a **default**, and
**configurable** — the value is consistency, not the specific patterns. If you change them,
change them in **one place**: the naming map in `AGENTS.md` (see `08-ai-agent-first.md`) and the
plop templates, then let the naming lint enforce the new convention. Directories stay kebab-case
regardless; kebab-case component files match what the shadcn CLI emits, which is why they are
the default here.

## Output-Scaling Reminder

The fullest layout in these docs is a **ceiling, not a mandate**. Adapt depth to project size:
small tools skip route groups, locale routing, and most of the harness; enterprise apps use the
full structure plus `docs/`, rubrics, and benchmark budgets. Do not over-engineer a small
project — apply YAGNI and add structure only where it pays for itself.

# AI-Agent-First — Instructions, Guardrails, Scaffolding

What makes this codebase safely extensible by AI coding agents (and humans): explicit machine-read
instructions (`AGENTS.md` / `CLAUDE.md`), CI-enforced architecture guardrails (ESLint boundaries +
`check-architecture.sh` + the `server-only`/`client-only` build gates), and deterministic
scaffolding (plop). This file owns the *rules and enforcement*; the *session lifecycle harness*
(feature_list.json, init.sh, handoff, checklists, benchmark/cleanup scripts) is
`13-harness-engineering.md` — together they are the project's operating system for agents.

## 1. `AGENTS.md` — the universal agent contract

Lives at the repo root. An agent reads it at the start of EVERY task. Keep it short enough to be
read every time: routing and invariants, not a manual — deep content stays in `docs/` and this
prompt set. Required sections:

````markdown
# AGENTS.md

## Startup (in order)
1. Read this file, then `session-handoff.md` (previous session context).
2. Read `feature_list.json` — current feature status; ONE feature in progress at a time.
3. Run `bash init.sh` if this is a fresh clone / resumed session (verifies toolchain + build).

## Commands
- `pnpm dev` — Next dev server, Turbopack (http://localhost:3000)
- `pnpm generate:api` — regenerate src/api/generated from openapi.json (after any spec change)
- `pnpm check` — tsc --noEmit
- `pnpm lint` — ESLint (boundaries + naming + hooks)
- `pnpm arch` — bash scripts/check-architecture.sh
- `pnpm test` / `pnpm test:e2e` — Vitest / Playwright
- `pnpm build && pnpm start` — production build (route table printed at build is the rendering truth)
- `pnpm plop feature -- --name <kebab-name>` — scaffold a feature slice + its segment folder

## The Rings (dependency rule — CI-enforced)
app/ (thin segments) → features/<name>/ → { components|lib|hooks (kernel), api/ }
- A feature NEVER imports another feature. Nothing imports app/.
- src/api/generated/** is READ-ONLY — regenerate, never edit.
- No fetch/axios outside src/api/ — the mutator + src/api/errors.ts are the only two files
  that read wire shapes. No server data in stores/useState.
- Import features only via `@/features/<name>` (its index.ts).

## The server/client boundary (build-enforced)
- Server Components by default; "use client" on interactive LEAVES only.
- Secret-reading modules import `server-only`; window-touching modules import `client-only`.
- Secrets never in NEXT_PUBLIC_*. Navigation via @/i18n/navigation, never next/link directly.
- Authenticated data: dynamic + TanStack Query. Public cached data: Next tags. ONE owner per
  surface, stated per segment (07-rendering-caching.md).

## File naming (lint-enforced)
App Router reserved names (page/layout/loading/error/route, proxy.ts); otherwise kebab-case;
`use-*.ts` hooks; `*.schema.ts`; `*.store.ts`; `*.test.tsx`; e2e in `e2e/*.spec.ts`.
Components export PascalCase.

## Where do I add a new feature?
1. `pnpm plop feature -- --name <name>` → slice under src/features/<name>/ + thin segment
   folder under src/app/[locale]/(app)/<name>/.
2. Fill the page: metadata + rendering decision + prefetch + compose the feature.
3. Add locales `messages/<lng>/<name>.json` + one import line per `messages/<lng>.ts`.
4. If the API grew: sync `openapi.json`, `pnpm generate:api`, commit spec + generated together.
5. Add the entry to `feature_list.json` (status "in-progress").
6. Done means: `pnpm check && pnpm lint && pnpm arch && pnpm test` green, feature verified in
   the running app, feature_list.json status "pass" WITH evidence, handoff updated.

## Do
- Use generated fetch functions (server) + generated hooks/keys (client); invalidate after
  mutations; revalidateTag when a public cached page shows the data.
- Use `t('<key>')` (next-intl) for every user-facing string; Link/useRouter from @/i18n/navigation.
- Use kernel primitives (components/ui) and `cn()`.
- Keep diffs to ONE feature slice per task.

## Do NOT
- Edit src/api/generated/**, add tailwind.config.js, or use @tailwind v3 directives.
- Put "use client" on pages/layouts that only compose; import next/headers or server env into
  client components.
- Cache authenticated API data in Next's Data Cache; own one surface with two caches.
- Copy query data into useState/stores; inspect HTTP status in components — branch on
  `mapApiError` output (`src/api/errors.ts`, 04 §3) instead.
- Import across features, deep-import past a feature's index.ts, or import app/ from anywhere.
- Mark a feature "pass" without runtime evidence (see 13-harness-engineering.md).
````

## 2. `CLAUDE.md` — the Claude Code entrypoint

Thin, links the contract, adds Claude-specific notes:

```markdown
# CLAUDE.md
Read AGENTS.md first — it is the contract. Then session-handoff.md and feature_list.json.
- Commands, rings, boundary rules, and naming: see AGENTS.md (do not improvise alternatives).
- Deep rules live in docs/spec/ (init-nextjs prompt set) — enter at docs/spec/00-system-prompt.md:
  01 architecture, 02 folders, 03 UI, 04 data, 05 auth, 06 i18n, 07 rendering/caching,
  09 testing, 13 harness, 14 design-first.
- Verification gate before declaring done: bash init.sh && pnpm test — plus runtime check
  in the browser (pnpm dev) for any UI-visible change, and the build route table for any
  rendering-mode change.
```

## 3. Guardrails in CI — lint the architecture, don't trust memory

### 3a. eslint-plugin-boundaries (ring + feature privacy rules)

ESLint 9 flat config. Element types mirror `01-architecture-principles.md` §3.
(Version note: pin v7 or the long-stable v6 API and record it in AGENTS.md.)

```js
// eslint.config.js (excerpt)
settings: {
  'boundaries/elements': [
    { type: 'app',      pattern: 'src/app/**' },
    { type: 'feature',  pattern: 'src/features/*/**', capture: ['featureName'] },
    { type: 'api',      pattern: 'src/api/**' },
    { type: 'kernel',   pattern: 'src/{components,lib,hooks,stores,types,i18n}/**' },
  ],
},
rules: {
  'boundaries/element-types': ['error', {
    default: 'disallow',
    rules: [
      { from: 'app',     allow: ['app', 'feature', 'api', 'kernel'] },
      { from: 'feature', allow: ['kernel', 'api', ['feature', { featureName: '${from.featureName}' }]] },
      { from: 'api',     allow: ['api', 'kernel'] },
      { from: 'kernel',  allow: ['kernel'] },
    ],
  }],
}
```

(`src/auth.ts` and `src/proxy.ts` are app-ring files by role — add them to the `app` pattern
list so the boundary rules cover them.)

**v7 syntax.** The excerpt above is the v6 API. On eslint-plugin-boundaries 7 the rule is
`boundaries/dependencies` with `policies: [{ from: { element: { type } }, allow: { to: { element: { types } } } }]`
and the same-feature capture is `'{{ from.element.captured.featureName }}'`. v7 element patterns
match FOLDERS: a single-file descriptor (`src/proxy.ts`) warns ("appear to use file patterns";
`mode: 'file'` is deprecated) — either classify it via `boundaries/files` or leave it
unclassified when it imports only kernel modules, and say which in `AGENTS.md`. Always prove the
config with a probe (a throwaway kernel file importing a feature must fail lint).

### 3b. Import bans (`no-restricted-imports`)

- Raw `fetch` wrappers/`axios` outside `src/api/**` — the mutator + `src/api/errors.ts` are the
  only two files that read wire shapes.
- Deep feature imports: `@/features/*/…` from outside that feature (only `@/features/<name>`
  via its `index.ts`).
- `@/app/*` from anywhere outside `src/app`.
- `next/link` + `next/navigation` inside `src/features/**` — use `@/i18n/navigation` (06 §4).
- `next/headers` inside any `"use client"` file (the `server-only` marker catches most of this
  at build; the lint ban catches the rest early).

### 3c. `scripts/check-architecture.sh` — belt and braces

Grep-based checks that survive any ESLint misconfiguration, CI-run and part of `pnpm arch`
(full script spec in `13-harness-engineering.md` §5):

1. No hand edits: `pnpm generate:api && git diff --exit-code src/api/generated openapi.json`.
2. No `tailwind.config.{js,ts}` present; no `@tailwind ` directives in CSS.
3. No secret-shaped names in `NEXT_PUBLIC_*` (grep `.env.example` + `src` for
   `NEXT_PUBLIC_.*(SECRET|KEY|TOKEN)`).
4. No `import ... from '@/features/` in `src/components|lib|hooks` (kernel purity).
5. Locale key parity: every `messages/en/*.json` key set matches each other language.

### 3d. CI pipeline (every PR)

```
pnpm install → pnpm check → pnpm lint → pnpm arch → pnpm test (coverage gate)
→ pnpm build (route table + server/client marker violations fail HERE)
→ pnpm test:e2e (Playwright against pnpm start) → [Prod] scripts/benchmark.sh budgets
```

An agent cannot silently break layering: the same commands it is told to run locally are the ones
CI runs — no hidden gates, no "works on the agent's machine". Note `pnpm build` is itself a
guardrail here: `server-only` violations and boundary-crossing imports are build ERRORS.

## 4. Deterministic scaffolding — `plopfile.cjs`

One command emits an identical, correct feature slice; the agent fills bodies, never invents
structure (the repeatable companion is `10-feature-scaffold-prompt.md`):

```
pnpm plop feature -- --name events
  → src/features/events/{index.ts, components/, hooks/}
  → src/features/events/events.test.tsx            (RTL + MSW skeleton)
  → src/app/[locale]/(app)/events/{page.tsx, loading.tsx, error.tsx}   (thin skeletons)
  → messages/{en,vi}/events.json + one import line per messages/<lng>.ts
  → appends a feature entry (status: "todo") to feature_list.json
```

Template rules: kebab-case everywhere; `index.ts` starts EMPTY of logic (exports only); the
page skeleton contains the metadata stub + a TODO rendering-decision comment; the test skeleton
imports `renderWithProviders` from `src/test/render.tsx`. The page is emitted as a skeleton but
its rendering decision and prefetch wiring are deliberate edits reviewed in context.

## 5. Optional: an AI feature inside the product

If the product itself ships an AI capability (chat, assistant), it is just a feature slice —
`features/assistant/` — talking to YOUR backend's endpoints, which the OpenAPI spec covers like
any other tag. The LLM SDK, prompts, and keys live in the backend (see the sibling
`init-nestjs-hexagonal` set's `08-ai-agent-first.md`, `LlmPort`/`ClaudeLlmAdapter`); the
frontend consumes generated hooks (`useSendMessage`, `useListConversations`) and renders
streams. **Never** put an Anthropic/OpenAI API key in `NEXT_PUBLIC_*` env — anything
`NEXT_PUBLIC_`-prefixed ships to every browser. (A key in plain server env used by a route
handler is acceptable ONLY for a BFF-less prototype — record it as debt.)

## 6. Smells — agent self-check

- AGENTS.md commands that don't match `package.json` scripts (drift = agents run wrong gates).
- A rule repeated in chat/session notes instead of being fixed into AGENTS.md.
- Boundaries plugin installed but `default: 'disallow'` missing (allow-by-default is no guardrail).
- The plop template and the naming table in `02-folder-structure.md` disagreeing.
- CI running different commands than AGENTS.md tells the agent to run.
- A module reading server env without the `server-only` marker (the build gate silently absent).
- A secret in `NEXT_PUBLIC_*` env, a committed `.env`, or an LLM key anywhere client-reachable.

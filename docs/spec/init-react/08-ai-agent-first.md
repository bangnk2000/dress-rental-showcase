# AI-Agent-First — Instructions, Guardrails, Scaffolding

What makes this codebase safely extensible by AI coding agents (and humans): explicit machine-read
instructions (`AGENTS.md` / `CLAUDE.md`), CI-enforced architecture guardrails (ESLint boundaries +
`check-architecture.sh`), and deterministic scaffolding (plop). This file owns the *rules and
enforcement*; the *session lifecycle harness* (feature_list.json, init.sh, handoff, checklists,
benchmark/cleanup scripts) is `13-harness-engineering.md` — together they are the project's
operating system for agents.

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
- `pnpm dev` — Vite dev server (http://localhost:5173)
- `pnpm generate:api` — regenerate src/api/generated from openapi.json (after any spec change)
- `pnpm check` — tsc --noEmit
- `pnpm lint` — ESLint (boundaries + naming + hooks)
- `pnpm arch` — bash scripts/check-architecture.sh
- `pnpm test` / `pnpm test:e2e` — Vitest / Playwright
- `pnpm build && pnpm preview` — production build (required before PWA verification)
- `pnpm plop feature -- --name <kebab-name>` — scaffold a feature slice

## The Rings (dependency rule — CI-enforced)
app/ → features/<name>/ → { components|lib|hooks (kernel), api/ }
- A feature NEVER imports another feature. Nothing imports app/.
- src/api/generated/** is READ-ONLY — regenerate, never edit.
- No axios/fetch outside src/api/. No server data in stores/useState.
- Import features only via `@/features/<name>` (its index.ts).

## File naming (lint-enforced)
kebab-case files; `use-*.ts` hooks; `*.store.ts`; `*.schema.ts`; `*-provider.tsx`;
`*-route.tsx`; `*.test.tsx`; e2e in `e2e/*.spec.ts`. Components export PascalCase.

## Where do I add a new feature?
1. `pnpm plop feature -- --name <name>` → slice under src/features/<name>/.
2. Wire the route in `app/router.tsx` (lazy import of the feature's index).
3. Add locales `public/locales/<lng>/<name>.json` + register in `src/types/i18next.d.ts`.
4. If the API grew: sync `openapi.json`, `pnpm generate:api`, commit spec + generated together.
5. Add the entry to `feature_list.json` (status "in-progress").
6. Done means: `pnpm check && pnpm lint && pnpm arch && pnpm test` green, feature verified in
   the running app, feature_list.json status "pass" WITH evidence, handoff updated.

## Do
- Use generated hooks + generated query keys; invalidate after mutations.
- Use `t('<ns>:<key>')` for every user-facing string.
- Use kernel primitives (components/ui) and `cn()`.
- Keep diffs to ONE feature slice per task.

## Do NOT
- Edit src/api/generated/**, add tailwind.config.js, or use @tailwind v3 directives.
- Copy query data into useState/stores; inspect error.response.status in components.
- Import across features, deep-import past a feature's index.ts, or import app/ from anywhere.
- Mark a feature "pass" without runtime evidence (see 13-harness-engineering.md).
````

## 2. `CLAUDE.md` — the Claude Code entrypoint

Thin, links the contract, adds Claude-specific notes:

```markdown
# CLAUDE.md
Read AGENTS.md first — it is the contract. Then session-handoff.md and feature_list.json.
- Commands, rings, and naming: see AGENTS.md (do not improvise alternatives).
- Deep rules live in docs/spec/ (init-react prompt set): 01 architecture, 02 folders,
  03 UI, 04 data, 05 auth, 06 i18n, 07 PWA, 09 testing, 13 harness.
- Verification gate before declaring done: bash init.sh && pnpm test — plus runtime check
  in the browser (pnpm dev) for any UI-visible change.
```

## 3. Guardrails in CI — lint the architecture, don't trust memory

### 3a. eslint-plugin-boundaries (ring + feature privacy rules)

ESLint 9 flat config. Element types mirror `01-architecture-principles.md` §3.
(Version note: v7.0.0 landed 2026-07 with a new "file descriptors" classification model; the
element-type rules below express the same contract in either v7 or the long-stable v6 API — pin
one and record it in AGENTS.md.)

```js
// eslint.config.js (excerpt)
settings: {
  'boundaries/elements': [
    { type: 'app',      pattern: 'src/app/**' },
    { type: 'feature',  pattern: 'src/features/*/**', capture: ['featureName'] },
    { type: 'api',      pattern: 'src/api/**' },
    { type: 'kernel',   pattern: 'src/{components,lib,hooks,stores,types}/**' },
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

### 3b. Import bans (`no-restricted-imports`)

- `axios`, `fetch` wrappers outside `src/api/**` — the mutator is the only HTTP door.
- Deep feature imports: `@/features/*/…` from outside that feature (only `@/features/<name>`
  via its `index.ts`).
- `@/app/*` from anywhere outside `src/app`.
- `react-i18next`'s `Trans`/`t` misuse is covered by review; hardcoded-string linting can be added
  via `eslint-plugin-i18next` (Optional).

### 3c. `scripts/check-architecture.sh` — belt and braces

Grep-based checks that survive any ESLint misconfiguration, CI-run and part of `pnpm arch`
(full script spec in `13-harness-engineering.md` §5):

1. No hand edits: `pnpm generate:api && git diff --exit-code src/api/generated openapi.json`.
2. No `tailwind.config.{js,ts}` present; no `@tailwind ` directives in CSS.
3. No `localStorage.setItem` of anything token-like outside the session module.
4. No `import ... from '@/features/` in `src/components|lib|hooks` (kernel purity).
5. Locale key parity: every `en/*.json` key set matches each other language.

### 3d. CI pipeline (every PR)

```
pnpm install → pnpm check → pnpm lint → pnpm arch → pnpm test (coverage gate)
→ pnpm build → pnpm test:e2e (Playwright against preview) → [Prod] scripts/benchmark.sh budgets
```

An agent cannot silently break layering: the same commands it is told to run locally are the ones
CI runs — no hidden gates, no "works on the agent's machine".

## 4. Deterministic scaffolding — `plopfile.cjs`

One command emits an identical, correct feature slice; the agent fills bodies, never invents
structure (the repeatable companion is `10-feature-scaffold-prompt.md`):

```
pnpm plop feature -- --name invoices
  → src/features/invoices/{index.ts, components/, hooks/}
  → src/features/invoices/invoices.test.tsx        (RTL + MSW skeleton)
  → public/locales/en/invoices.json (+ per configured lng)
  → appends the namespace line to src/types/i18next.d.ts
  → appends a feature entry (status: "todo") to feature_list.json
```

Template rules: kebab-case everywhere; `index.ts` starts EMPTY of logic (exports only); the test
skeleton imports `renderWithProviders` from `src/test/render.tsx`; no route wiring (that edit is
deliberate, in `app/router.tsx`, reviewed by a human/agent in context).

## 5. Optional: an AI feature inside the product

If the product itself ships an AI capability (chat, assistant), it is just a feature slice —
`features/assistant/` — talking to YOUR backend's endpoints, which the OpenAPI spec covers like
any other tag. The LLM SDK, prompts, and keys live in the backend (see the sibling
`init-nestjs-hexagonal` set's `08-ai-agent-first.md`, `LlmPort`/`ClaudeLlmAdapter` with default
model `claude-sonnet-4-6`); the frontend consumes generated hooks (`useSendMessage`,
`useListConversations`) and renders streams. **Never** put an Anthropic/OpenAI API key in
`VITE_*` env — anything `VITE_`-prefixed ships to every browser.

## 6. Smells — agent self-check

- AGENTS.md commands that don't match `package.json` scripts (drift = agents run wrong gates).
- A rule repeated in chat/session notes instead of being fixed into AGENTS.md.
- Boundaries plugin installed but `default: 'disallow'` missing (allow-by-default is no guardrail).
- The plop template and the naming table in `02-folder-structure.md` disagreeing.
- CI running different commands than AGENTS.md tells the agent to run.
- A secret in `VITE_*` env, committed `.env`, or an LLM key anywhere in the frontend.

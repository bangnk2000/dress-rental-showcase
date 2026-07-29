# Implementation Checklist — Zero to First Harnessed Feature

An ordered, practical checklist to bootstrap the repo from an empty directory to a first working,
tested, harnessed feature slice that an AI coding agent can extend safely. Phases are sequential;
items inside a phase mostly are too. Tick `[ ]` as you go.

**Output-Scaling note:** the fullest format here is a CEILING. For a small project, collapse
phases 7 (PWA) and parts of 8–9 until the product earns them — see the YAGNI guidance in
`01-architecture-principles.md`. For an enterprise build, do every phase. Do not over-engineer a
two-screen tool.

Priority key (matches sibling files): **Required** · **Optional** · **Prod-only** · **Experimental**.

---

## Phase 0 — Prereqs & decisions (Required)

Lock these before writing code; they shape every later phase.

- [ ] Pin **Node 22 LTS, ≥ 22.18** (`.nvmrc` / `engines.node`). The floor is set by **Orval 8
      (≥ 22.18)**, which is higher than Vite 8's 20.19+/22.12+ — one runtime for both.
- [ ] Package manager: **pnpm**. Commit the lockfile.
- [ ] Target versions (mid-2026 stable lines — verify `latest` at init time):
      **Vite 8.1** (Rolldown/Oxc; ESM-only) · **@vitejs/plugin-react 6** · **React 19.2** ·
      **TypeScript 5.9+/6.0** · **Tailwind CSS 4.3** · **shadcn CLI 4** · **TanStack Query 5** ·
      **Orval 8.20** · **@react-oauth/google 0.13** · **i18next 26 / react-i18next 17** ·
      **vite-plugin-pwa 1.3** · **Vitest 4 / MSW 2 / Playwright 1.6x** ·
      **eslint-plugin-boundaries 7** (or pin 6.x — record the choice, `08-ai-agent-first.md` §3a).
- [ ] Obtain or commit **`openapi.json`** (the data layer's input). No spec → decide the §6-of-04
      fallback consciously.
- [ ] Decide the **auth model**: credential (ID token) vs auth-code flow; cookie session vs
      bearer+refresh (`05-auth-google.md` §2/§4). Create the Google OAuth client ID.
- [ ] Decide **routing** (React Router 7 assumed by this set — TanStack Router is a legitimate
      swap; record it in AGENTS.md), **languages** for i18n, and whether **PWA is in scope**.
- [ ] Record every decision above in `AGENTS.md` when Phase 5 creates it.

## Phase 1 — Init Vite + TS + lint/format (Required)

- [ ] `pnpm create vite@latest <app> --template react-ts` → Vite 8 + plugin-react 6 baseline.
- [ ] `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
      `resolveJsonModule`, `paths: { "@/*": ["./src/*"] }` (+ matching `resolve.alias` in Vite).
- [ ] **ESLint 9 flat config** (`eslint.config.js`): typescript-eslint, react-hooks,
      react-refresh; Prettier (or Biome — pick ONE formatter repo-wide and record it).
- [ ] npm scripts: `dev`, `build`, `preview`, `check` (tsc --noEmit), `lint`, `format`, `test`,
      `test:e2e`, `generate:api`, `arch`, `plop`.
- [ ] Commit `.gitignore`, `.editorconfig`, `.env.example` (`VITE_API_BASE_URL`,
      `VITE_GOOGLE_CLIENT_ID` — keys only; remember `VITE_*` ships to the browser).

## Phase 2 — UI foundation: Tailwind v4 + shadcn/ui (Required)

Per `03-ui-layer.md`.

- [ ] `pnpm add tailwindcss @tailwindcss/vite`; add `tailwindcss()` to `vite.config.ts`;
      `@import "tailwindcss"` in `src/app/index.css`. **No** `tailwind.config.js`, **no** PostCSS
      config, **no** `@tailwind` directives.
- [ ] Declare brand tokens in `@theme` (oklch); base layer tweaks (e.g. button cursor) once.
- [ ] `pnpm dlx shadcn@latest init` → `components.json` (aliases per `02-folder-structure.md`),
      `lib/utils.ts` (cn), CSS variables + `.dark` block.
- [ ] `pnpm dlx shadcn@latest add button input form dialog table badge toast` (what the first
      feature needs — not the whole registry).
- [ ] Build the kernel feedback set: `spinner.tsx`, `empty-state.tsx`, `error-fallback.tsx`.

## Phase 3 — Data layer: Orval → TanStack Query (Required)

Per `04-data-layer.md`.

- [ ] `pnpm add @tanstack/react-query axios` · `pnpm add -D orval`.
- [ ] Write `src/api/mutator/custom-instance.ts`: AXIOS_INSTANCE + auth-header request
      interceptor + deduplicated 401→refresh→retry response interceptor + `customInstance<T>`.
- [ ] Write `orval.config.ts`: `mode: 'tags-split'`, `client: 'react-query'`,
      `httpClient: 'axios'` (explicit — Orval 8 defaults to fetch), mutator override,
      `useSuspenseQuery: true`, `clean: true`; optional second `zod` output with
      `fileExtension: '.zod.ts'`.
- [ ] `pnpm generate:api` → commit `openapi.json` + `src/api/generated/` together.
- [ ] QueryClient defaults in `app/providers.tsx`: `staleTime: 60_000`, `retry: 1`,
      `throwOnError` for 5xx/network.
- [ ] Wire the CI freshness check: `pnpm generate:api && git diff --exit-code src/api/generated`.

## Phase 4 — App shell: providers, router, layouts (Required)

- [ ] `app/providers.tsx`: QueryClientProvider → GoogleOAuthProvider → SessionProvider →
      ThemeProvider → global ErrorBoundary (order matters: session uses the query client).
- [ ] `app/router.tsx`: route tree with lazy feature imports, `RouteBoundary` (error boundary +
      Suspense fallback) per route, `not-found-route.tsx`.
- [ ] `app/layouts/root-layout.tsx`: nav shell, `<Outlet/>`, toaster, (later) PWA update prompt.
- [ ] `main.tsx`: css import, `lib/i18n` side-effect import, createRoot.

## Phase 5 — Harness & guardrails (Required — this is the differentiator)

Per `08-ai-agent-first.md` + `13-harness-engineering.md`. Do this BEFORE the first feature, not
after — the first feature is built under the harness.

- [ ] `AGENTS.md` (contract: startup order, commands, rings, naming, do/do-not, "where do I add a
      feature") + thin `CLAUDE.md`.
- [ ] `feature_list.json` seeded from the planned feature table (section 2 of the 00-prompt
      output), all `"todo"`.
- [ ] `init.sh`: install → check → lint → arch → test → build + harness-file presence check.
- [ ] `session-handoff.md`, `claude-progress.md`, `clean-state-checklist.md` skeletons.
- [ ] `eslint-plugin-boundaries` ring rules (`default: 'disallow'`) + `no-restricted-imports`
      bans (axios outside api/, deep feature imports, app/ imports).
- [ ] `scripts/check-architecture.sh` (the five checks in `08-ai-agent-first.md` §3c) wired as
      `pnpm arch`.
- [ ] `plopfile.cjs` feature generator (slice + locales + d.ts line + feature_list entry).
- [ ] CI pipeline: check → lint → arch → test → build → e2e (`08-ai-agent-first.md` §3d).

## Phase 6 — Auth + i18n (Required for Standard tier)

Per `05-auth-google.md` and `06-i18n.md`.

- [ ] `pnpm add @react-oauth/google` · `features/auth/`: `session-provider.tsx`,
      `use-session.ts`, `google-sign-in-button.tsx`, `require-auth.tsx`; sign-in route.
- [ ] Backend handshake: POST the Google credential (ID token) to `/auth/*` via the **generated**
      auth hooks; session per the Phase-0 model; sign-out clears session + `queryClient.clear()`.
- [ ] `pnpm add i18next react-i18next i18next-http-backend i18next-browser-languagedetector`.
- [ ] `lib/i18n.ts` init (http-backend, detector, `common` default NS);
      `public/locales/{lng}/common.json`; `types/i18next.d.ts` augmentation;
      language switcher in the root layout; `<html lang>` sync.

## Phase 7 — PWA (Optional — only if in scope)

Per `07-pwa.md`.

- [ ] `pnpm add -D vite-plugin-pwa`; `VitePWA({ registerType: 'prompt', manifest, workbox })`
      with `navigateFallbackDenylist: [/^\/api\//]` and API `NetworkOnly` runtime rule.
- [ ] Manifest icons (192/512 + maskable); `theme_color` synced with `@theme`.
- [ ] `PwaUpdatePrompt` (via `virtual:pwa-register/react`) rendered in the root layout;
      `"types": ["vite-plugin-pwa/react"]`.
- [ ] Verify against a real build: `pnpm build && pnpm preview` → Lighthouse PWA pass, update
      prompt on redeploy, offline deep link serves the shell.

## Phase 8 — First feature slice (Required)

Per `10-feature-scaffold-prompt.md`, benchmarked against `11-example-output.md`.

- [ ] `pnpm plop feature -- --name <first-feature>`.
- [ ] Fill the slice: Suspense list view + validated form + generated-mutation wiring +
      status/empty/error surfaces + namespace JSONs.
- [ ] Wire the route (lazy, guarded); verify the three states and the invalidation in `pnpm dev`.
- [ ] Move its `feature_list.json` entry to `"pass"` WITH runtime evidence.

## Phase 9 — Tests + coverage gate (Required)

Per `09-testing-strategy.md`.

- [ ] `pnpm add -D vitest @testing-library/react @testing-library/user-event
      @testing-library/jest-dom jsdom msw @playwright/test`.
- [ ] `src/test/`: `setup.ts` (MSW server lifecycle, `onUnhandledRequest: 'error'`),
      `msw/server.ts` + per-tag handlers (typed from generated models), `render.tsx`
      (fresh QueryClient, test i18n, MemoryRouter).
- [ ] Slice tests: happy/empty/error/validation for the first feature (see `11-example-output.md` §10).
- [ ] Playwright: auth bypass fixture, core flow spec, (if PWA) offline spec; runs against
      `pnpm preview` in CI.
- [ ] Coverage gate on `src/features/**` + `src/lib/**` (exclude `api/generated`, `components/ui`).

## Phase 10 — Observability & production hardening (Prod-only)

- [ ] Error tracking (Sentry or equivalent) wired in the global boundary + QueryCache
      `onError` — behind a tiny wrapper so the vendor is swappable.
- [ ] `scripts/benchmark.sh`: bundle-size budget (fail CI over threshold) + Lighthouse budgets
      (`13-harness-engineering.md` §5).
- [ ] `scripts/cleanup-scanner.sh`: dead exports (knip), unused locale keys, orphan assets.
- [ ] Security pass: no tokens in localStorage (unless consciously accepted), CSP headers on the
      host, `pnpm audit` in CI, dependabot/renovate.
- [ ] `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/RELIABILITY.md` for agent deep-reading
      (Enterprise tier).

---

## Final check (before declaring "first feature done")

- [ ] `bash init.sh` passes end-to-end on a fresh clone.
- [ ] One command (`pnpm plop feature`) regenerates an identical, correct slice skeleton.
- [ ] `pnpm check`, `lint`, `arch`, `test`, `build`, `test:e2e` are green in CI — and CI runs the
      SAME commands AGENTS.md gives the agent.
- [ ] No file under `src/api/generated/**` was hand-edited (freshness check proves it).
- [ ] The dependency rule holds: no cross-feature import, nothing imports `app/`, kernel is
      product-agnostic — boundaries lint proves it.
- [ ] Every user-facing string resolves through a namespace; locale key parity holds.
- [ ] `feature_list.json` reflects reality (statuses have evidence); `session-handoff.md` and
      `claude-progress.md` describe the current state; `clean-state-checklist.md` passes.

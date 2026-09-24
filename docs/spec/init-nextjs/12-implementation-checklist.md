# Implementation Checklist — Zero to First Harnessed Feature

An ordered, practical checklist to bootstrap the repo from an empty directory to a first working,
tested, harnessed feature slice that an AI coding agent can extend safely. Phases are sequential;
items inside a phase mostly are too. Tick `[ ]` as you go.

**Output-Scaling note:** the fullest format here is a CEILING. For a small project, collapse
phase 7 (rendering/SEO — keep only the dynamic default) and parts of 8–9 until the product earns
them — see the YAGNI guidance in `01-architecture-principles.md`. For an enterprise build, do
every phase. Do not over-engineer a two-screen tool.

Priority key (matches sibling files): **Required** · **Optional** · **Prod-only** · **Experimental**.

---

## Phase 0 — Prereqs & decisions (Required)

Lock these before writing code; they shape every later phase.

- [ ] Pin **Node 22 LTS, ≥ 22.18** (`.nvmrc` / `engines.node`). The floor is set by **Orval 8
      (≥ 22.18)** — comfortably above Next 16's minimum; one runtime for both.
- [ ] Package manager: **pnpm**. Commit the lockfile.
- [ ] Target versions (mid-2026 stable lines — verify `latest` at init time):
      **Next.js 16.x** (App Router, Turbopack default) · **React 19.2** ·
      **TypeScript 5.9+/6.0** · **Tailwind CSS 4.3** (`@tailwindcss/postcss`) · **shadcn CLI 4** ·
      **TanStack Query 5** · **Orval 8.20** · **next-auth v5 (Auth.js)** · **next-intl 4** ·
      **Vitest 4 / MSW 2 / Playwright 1.6x** · **eslint-plugin-boundaries 7** (or pin 6.x —
      record the choice, `08-ai-agent-first.md` §3a).
- [ ] Write the **Level-1 bootstrap brief** (`docs/BOOTSTRAP.md`, per `14-design-first.md` §1):
      product paragraph, slice table (SRS ↔ API tags ↔ phases — it seeds `feature_list.json`),
      Phase-0 decisions, the **public/authenticated route-group split + per-segment rendering
      table**, and **contract gaps** with a decision each (block / stub / BE request).
- [ ] Obtain or commit **`openapi.json`** (the data layer's input). No spec → decide the §6-of-04
      fallback consciously.
- [ ] Decide the **session owner**: backend-owned cookie (model A, recommended with the NestJS
      sibling) vs Auth.js JWT (model B) — `05-auth-google.md` §2. Create the Google OAuth client.
- [ ] Decide **languages** + locale routing (`localePrefix`), and which pages are PUBLIC +
      indexable (drives the route groups and metadata scope — `07-rendering-caching.md`).
- [ ] Record every decision above in `AGENTS.md` when Phase 5 creates it.

## Phase 1 — Init Next.js + TS + lint/format (Required)

- [ ] `pnpm create next-app@latest <app> --ts --app --src-dir --eslint` (Tailwind said NO here —
      v4 is wired manually in Phase 2; the starter still templates v3-style config on some lines).
- [ ] `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
      `resolveJsonModule`, `paths: { "@/*": ["./src/*"] }`.
- [ ] `next.config.ts`: the `/api/be/:path*` rewrite to `${API_URL}` (04 §1), `typedRoutes`,
      image `remotePatterns` as needed.
- [ ] **ESLint 9 flat config** (`eslint.config.js`): typescript-eslint, react-hooks,
      `@next/eslint-plugin-next`; Prettier (or Biome — pick ONE formatter repo-wide and record it).
- [ ] npm scripts: `dev`, `build`, `start`, `check` (**`next typegen && tsc --noEmit`** — on a
      fresh clone `next-env.d.ts` and the global `PageProps`/`LayoutProps` route types do not exist
      until Next generates them, so a bare `tsc --noEmit` fails; gitignore `next-env.d.ts`), `lint`,
      `format`, `test`, `test:e2e`, `generate:api`, `arch`, `plop`.
- [ ] pnpm ≥ 10 blocks dependency build scripts: Next/next-intl pull `@parcel/watcher` and
      `@swc/core`, which ship prebuilt binaries — list them in `allowBuilds` (`false`) so
      `pnpm install` does not stop with `ERR_PNPM_IGNORED_BUILDS`.
- [ ] Commit `.gitignore`, `.editorconfig`, `.env.example` (`API_URL`, `AUTH_SECRET`,
      `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_*` — keys only; remember
      `NEXT_PUBLIC_*` ships to the browser).

## Phase 2 — UI foundation: Tailwind v4 + shadcn/ui (Required)

Per `03-ui-layer.md`.

- [ ] `pnpm add tailwindcss @tailwindcss/postcss`; `postcss.config.mjs` with the plugin;
      `@import "tailwindcss"` in `src/app/globals.css`. **No** `tailwind.config.js`, **no**
      `@tailwind` directives.
- [ ] Declare brand tokens in `@theme` (oklch); base layer tweaks (e.g. button cursor) once;
      `next/font` variables wired into `--font-*` tokens.
- [ ] `pnpm dlx shadcn@latest init` → `components.json` (`rsc: true`, css →
      `src/app/globals.css`, aliases per `02-folder-structure.md`), `lib/utils.ts` (cn),
      CSS variables + `.dark` block.
- [ ] `pnpm dlx shadcn@latest add button input form table badge sonner` (what the first
      feature needs — not the whole registry).
      - [ ] Edit `components/ui/form.tsx` so `FormMessage` passes `error.message` through `t()` —
            schema messages are i18n KEYS, not text.
- [ ] Build the kernel feedback set: `spinner.tsx`, `empty-state.tsx`, `error-fallback.tsx`, plus
      `layout/page-header.tsx` and `src/lib/format.ts` (`formatDate`, …) — the example slice (11)
      imports them.
- [ ] Write `docs/design/ui-foundation.md` (`14-design-first.md` §3): density & device context,
      navigation model (ADR-worthy), shared patterns (table/form/confirm/toast/skeleton
      policies), i18n layout constraints. Slices assemble these patterns; they never invent their own.

## Phase 3 — Data layer: Orval → fetch + TanStack Query (Required)

Per `04-data-layer.md`.

- [ ] `pnpm add @tanstack/react-query` · `pnpm add -D orval`.
- [ ] Write `src/api/mutator/custom-fetch.ts`: isomorphic base-URL switch, server-side cookie
      forwarding, `cache: 'no-store'` default, timeout signal, `HttpError`, `onUnauthenticated`.
- [ ] Write `orval.config.ts`: `mode: 'tags-split'`, `client: 'react-query'`,
      `httpClient: 'fetch'`, mutator override, `useSuspenseQuery: true`, `clean: true`;
      optional second `zod` output with `fileExtension: '.zod.ts'`.
- [ ] `pnpm generate:api` → commit `openapi.json` + `src/api/generated/` together.
- [ ] Write `src/api/errors.ts` — `mapApiError` + `isServerOrNetworkError` (04 §3) — before the
      QueryClient defaults that reference it.
- [ ] `app/providers.tsx` (client island): QueryClient with `staleTime: 60_000`, `retry: 1`,
      `throwOnError`; `src/api/query-client.server.ts` (`cache()`-wrapped per-request client).
- [ ] Wire the CI freshness check: `pnpm generate:api && git diff --exit-code src/api/generated`.

## Phase 4 — App shell: layout, providers, proxy, route groups (Required)

- [ ] `app/layout.tsx`: `<html lang>`, fonts, `<Providers>`; `app/providers.tsx` client island
      (QueryClientProvider, theme).
- [ ] Route groups `(public)/` and `(app)/` (under `[locale]/` once Phase 6 lands) with their
      layouts; `not-found.tsx`, `global-error.tsx`.
- [ ] `src/proxy.ts`: locale routing (Phase 6) + optimistic auth redirects (Phase 5's model) with
      the standard matcher.
- [ ] Per-segment `loading.tsx`/`error.tsx` convention established (kernel fallback components).

## Phase 5 — Harness & guardrails (Required — this is the differentiator)

Per `08-ai-agent-first.md` + `13-harness-engineering.md`. Do this BEFORE the first feature, not
after — the first feature is built under the harness.

- [ ] `AGENTS.md` (contract: startup order, commands, rings + boundary rules, naming, do/do-not,
      "where do I add a feature") + thin `CLAUDE.md`.
- [ ] `feature_list.json` seeded from the planned feature table (section 2 of the 00-prompt
      output), all `"todo"`.
- [ ] `init.sh`: install → generated-layer freshness → check → lint → arch → test → build +
      harness-file presence check.
- [ ] `session-handoff.md`, `claude-progress.md`, `clean-state-checklist.md` skeletons.
- [ ] `eslint-plugin-boundaries` ring rules (`default: 'disallow'`) + `no-restricted-imports`
      bans (fetch/axios outside api/, deep feature imports, app/ imports, next/link +
      next/navigation in features, next/headers in client files).
- [ ] `server-only` + `client-only` packages installed; markers on the seed modules
      (`query-client.server.ts`, auth helpers).
- [ ] `scripts/check-architecture.sh` (the SEVEN checks specified in `13-harness-engineering.md`
      §5 — a superset of `08-ai-agent-first.md` §3c) wired as `pnpm arch`.
- [ ] `plopfile.cjs` feature generator (slice + segment folder + locales + aggregate line +
      feature_list entry).
- [ ] CI pipeline: check → lint → arch → test → build → e2e (`08-ai-agent-first.md` §3d).

## Phase 6 — Auth + i18n (Required for Standard tier)

Per `05-auth-google.md` and `06-i18n.md`.

- [ ] `pnpm add next-auth@beta`; `src/auth.ts` (Google provider, session-owner model from
      Phase 0), `app/api/auth/[...nextauth]/route.ts`; `npx auth secret`.
- [ ] Model A: the `signIn` callback exchanges the Google ID token with the backend's
      `/auth/google` via the **generated** function; sign-out revokes + `queryClient.clear()`.
- [ ] Guards: `(app)/layout.tsx` server-side `auth()` check; optimistic redirect in `proxy.ts`;
      `features/auth/` slice (sign-in button, user menu).
- [ ] `pnpm add next-intl`; `src/i18n/{routing,request,navigation}.ts`; move segments under
      `app/[locale]/`; `NextIntlClientProvider` in the root layout; `messages/{en,vi}/common.json`
      + per-locale aggregates; `IntlMessages` d.ts augmentation; language switcher in the shell.

## Phase 7 — Rendering, caching & SEO pass (Required for public surfaces)

Per `07-rendering-caching.md`.

- [ ] Fill the per-segment rendering table (from the bootstrap brief) and implement it: public
      cached segments get explicit `tags`/`revalidate` options through generated functions;
      authenticated segments stay dynamic (mutator default).
- [ ] `generateMetadata` on every public segment (localized, hreflang alternates); authenticated
      segments `robots: { index: false }`.
- [ ] `sitemap.ts` + `robots.ts` derived from the routing config.
- [ ] Revalidation triggers wired where mutations touch public cached data (`revalidateTag` via
      action or the secret-protected webhook route).
- [ ] `pnpm build` → route table matches the intended table; fix accidental flips.

## Phase 8 — First feature slice (Required)

Per `10-feature-scaffold-prompt.md`, benchmarked against `11-example-output.md`.

- [ ] Tier check (`14-design-first.md`): standard slice → filled `10` input contract; design-tier
      slice → `docs/design/<slice>.md` (UX flow + wireframe, URL state, data & invalidation map
      incl. rendering/caching row, interaction state machine, screen states) approved BEFORE
      scaffolding.
- [ ] `pnpm plop feature -- --name <first-feature>`.
- [ ] Fill the slice: thin page (metadata + prefetch + HydrationBoundary) + hydrated Suspense
      list + validated form + generated-mutation wiring + status/empty/error surfaces + one
      designed state per business outcome code + namespace JSONs.
- [ ] Verify the three states + each outcome state + the invalidation in `pnpm dev`; verify the
      declared rendering mode in the `pnpm build` route table.
- [ ] **Visual polish pass** after the slice works (`14-design-first.md` §4): spacing/responsive/
      dark/focus on the real app, then the UX checklist (locales render, keyboard flow, mobile
      overflow, empty/error seen with eyes). The DECISIONS (aria-live outcome region, responsive
      behavior) are made in the slice design doc (14 §2 template §4); the polish pass VERIFIES them.
- [ ] Move its `feature_list.json` entry to `"pass"` WITH runtime evidence — including the
      Playwright screenshot(s) of the finished screens.

## Phase 9 — Tests + coverage gate (Required)

Per `09-testing-strategy.md`.

- [ ] `pnpm add -D vitest @testing-library/react @testing-library/user-event
      @testing-library/jest-dom jsdom msw @playwright/test @vitejs/plugin-react`.
- [ ] `vitest.config.ts`: jsdom environment, react plugin, `setupFiles: ['./src/test/setup.ts']`
      (MSW server lifecycle + the `@/i18n/navigation` mock).
- [ ] `src/test/`: `setup.ts` (`onUnhandledRequest: 'error'`), `msw/server.ts` + per-tag handlers
      (typed from generated models, `/api/be` paths), `render.tsx` (fresh QueryClient,
      NextIntlClientProvider, Suspense + test error boundary — `09` §3).
- [ ] Slice tests: happy/empty/error/validation + one designed state per business outcome code
      for the first feature (see `11-example-output.md` §10).
- [ ] Playwright: session-minting auth fixture, core flow spec, RSC/SEO assertions for public
      pages, rendering-mode grep; runs against `pnpm build && pnpm start` in CI.
- [ ] Coverage gate on `src/features/**` + `src/lib/**` (exclude `api/generated`,
      `components/ui`, `src/app/**`).

## Phase 10 — Observability & production hardening (Prod-only)

- [ ] Error tracking (Sentry or equivalent) wired for BOTH sides: client boundary + server
      components/route handlers — behind a tiny wrapper so the vendor is swappable.
- [ ] `scripts/benchmark.sh`: bundle-size budget (fail CI over threshold; watch client-bundle
      growth from stray `"use client"`) + Lighthouse budgets (`13-harness-engineering.md` §5).
- [ ] `scripts/cleanup-scanner.sh`: dead exports (knip), unused locale keys, orphan assets.
- [ ] Security pass: secrets only in server env, security headers (CSP) in `next.config.ts` or
      the host, `pnpm audit` in CI, dependabot/renovate.
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
      product-agnostic — boundaries lint proves it. The server/client boundary holds — the build
      proves it (`server-only` gates, no secret in `NEXT_PUBLIC_*`).
- [ ] The build route table matches the intended per-segment rendering table.
- [ ] Every user-facing string resolves through a namespace; locale key parity holds.
- [ ] `feature_list.json` reflects reality (statuses have evidence); `session-handoff.md` and
      `claude-progress.md` describe the current state; `clean-state-checklist.md` passes.
- [ ] Design docs carry an approved/as-built status; no design-tier slice shipped without one
      (`14-design-first.md`).

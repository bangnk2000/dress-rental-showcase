# Folder Structure — Canonical Layout

This file is the single source of truth for WHERE every file lives. Ring responsibilities and the
contents of each building block are detailed in `03-ui-layer.md`, `04-data-layer.md`,
`05-auth-google.md`, `06-i18n.md`, and `07-rendering-caching.md`; this file owns the *tree*, the
*naming convention*, and the *priority* of each path.

The structure is **feature-slice-first** (bulletproof-react lineage) on top of the App Router:
`src/app/` holds thin route segments that compose features; a feature is a mini-app, and inside
it everything that changes together lives together (Common Closure) — server and client
components, hooks, form schemas, translations, tests. Features never import each other; they
share the kernel, the generated API layer, and the query cache. Enforce all of this with
eslint-plugin-boundaries + `scripts/check-architecture.sh` (see `08-ai-agent-first.md`).

## Output Scaling

The tree below is a CEILING for a multi-feature production app. Adapt depth to size:

- **Small / 1–2 screens**: one route group, one `features/<name>/` with flat files, single
  `common` i18n namespace, no locale-prefixed routing. YAGNI applies — `01-architecture-principles.md`.
- **Standard**: 3–8 features, full `api/` pipeline, auth feature, per-feature namespaces,
  public/app route groups, full harness.
- **Enterprise**: every folder shown, plus `docs/` hierarchy, per-feature e2e suites, benchmark +
  cleanup scripts wired as shown in `13-harness-engineering.md`.

## 1. Full Tree

```
project-root/
├── AGENTS.md                       # universal agent rules (rings, naming, commands)
├── CLAUDE.md                       # Claude Code specific entrypoint (links AGENTS.md)
├── feature_list.json               # harness: feature status + evidence (13-harness)
├── init.sh                         # harness: install → typecheck → lint → arch → test → build
├── session-handoff.md              # harness: previous-session context
├── claude-progress.md              # harness: session log
├── clean-state-checklist.md        # harness: end-of-session checks
├── openapi.json                    # the API contract (synced from backend; input to Orval)
├── orval.config.ts                 # openapi.json → src/api/generated (04-data-layer)
├── next.config.ts                  # rewrites (/api/be/* → backend), typedRoutes, images
├── postcss.config.mjs              # { plugins: { "@tailwindcss/postcss": {} } } (03-ui-layer)
├── tsconfig.json                   # strict, path alias @/* → src/*
├── eslint.config.js                # ESLint 9 flat config + boundaries + naming rules
├── plopfile.cjs                    # deterministic feature-slice generator
├── components.json                 # shadcn/ui CLI config (03-ui-layer)
├── playwright.config.ts            # e2e (09-testing-strategy)
├── vitest.config.ts                # unit/component tests (jsdom + RTL)
├── .env.example                    # API_URL, AUTH_* (server) + NEXT_PUBLIC_* — keys only
├── docs/                           # agent-readable docs (Enterprise; 13-harness)
│   ├── ARCHITECTURE.md
│   ├── PRODUCT.md
│   └── RELIABILITY.md
├── scripts/
│   ├── check-architecture.sh       # grep/lint boundary checks beyond ESLint
│   ├── benchmark.sh                # bundle size + Lighthouse budget (Prod-only)
│   └── cleanup-scanner.sh          # stale artifacts: orphan files, dead exports
├── public/                         # static assets (favicon, og images)
├── messages/                       # next-intl catalogs: {en,vi}/{common,events}.json + per-locale
│                                   #   aggregates en.ts/vi.ts (06-i18n)
├── e2e/                            # Playwright specs + fixtures
└── src/
    ├── proxy.ts                    # Next 16 middleware: locale routing + optimistic auth redirects
    ├── app/                        # composition root — thin route segments
    │   ├── globals.css             # Tailwind v4 entry: @import "tailwindcss" + @theme tokens
    │   ├── layout.tsx              # root layout: <html lang>, fonts, Providers
    │   ├── providers.tsx           # "use client": QueryProvider, theme (client island)
    │   ├── global-error.tsx        # last-resort boundary
    │   ├── not-found.tsx
    │   │                           # NOTE: with locale routing (06-i18n), (public)/ and (app)/
    │   │                           #   sit under app/[locale]/ — omitted below for brevity
    │   ├── (public)/               # route group: unauthenticated, SEO-relevant
    │   │   ├── layout.tsx          # public shell (marketing nav)
    │   │   ├── page.tsx            # home — static or cached (07-rendering-caching)
    │   │   └── sign-in/page.tsx
    │   ├── (app)/                  # route group: authenticated product
    │   │   ├── layout.tsx          # app shell: nav, session check, <Toaster/>
    │   │   ├── dashboard/page.tsx
    │   │   └── events/
    │   │       ├── page.tsx        # thin: metadata + prefetch + compose feature (11 §2)
    │   │       ├── loading.tsx     # streaming fallback
    │   │       ├── error.tsx       # segment boundary ("use client" by contract)
    │   │       └── [id]/page.tsx
    │   └── api/                    # route handlers — ONLY Auth.js + thin server needs
    │       └── auth/[...nextauth]/route.ts   # Auth.js handlers (05-auth-google)
    ├── auth.ts                     # Auth.js v5 config: providers, callbacks, session (05)
    ├── api/                        # generated API layer — machine-owned port
    │   ├── errors.ts               # mapApiError — the one seam that reads wire error shapes (04 §3)
    │   ├── mutator/
    │   │   └── custom-fetch.ts     # THE isomorphic adapter: base URL per side, cookie forward, 401
    │   └── generated/              # Orval output (tags-split) — READ-ONLY, regenerate only
    │       ├── events/events.ts            # listEvents(), useListEvents(), keys…
    │       ├── auth/auth.ts
    │       └── model/                      # OpenAPI schemas as TS types (+ *.zod.ts optional)
    ├── components/                 # shared kernel: UI with zero product knowledge
    │   ├── ui/                     # shadcn/ui primitives (CLI-added, repo-owned)
    │   │   ├── button.tsx
    │   │   ├── dialog.tsx
    │   │   └── form.tsx
    │   ├── layout/                 # generic shells: page-header.tsx, container.tsx
    │   └── feedback/               # spinner.tsx, error-fallback.tsx, empty-state.tsx
    ├── lib/                        # pure utilities — no React, no IO
    │   ├── utils.ts                # cn() — created by shadcn init
    │   └── format.ts               # date/number/currency via Intl (locale-aware)
    ├── i18n/                       # next-intl wiring (06-i18n)
    │   ├── routing.ts              # locales, defaultLocale, localePrefix
    │   ├── request.ts              # per-request config: load messages
    │   └── navigation.ts           # Link/redirect/usePathname/useRouter wrappers
    ├── hooks/                      # generic reusable hooks (use-debounce.ts, use-media-query.ts)
    ├── stores/                     # app-wide client state ONLY (theme.store.ts) — rare
    ├── types/                      # global TS types/augmentations (next-intl messages d.ts)
    ├── features/
    │   ├── auth/                   # feature == vertical slice == mini-app
    │   │   ├── index.ts            # PUBLIC SURFACE — the only import path for outsiders
    │   │   ├── components/
    │   │   │   ├── google-sign-in-button.tsx   # "use client"
    │   │   │   └── user-menu.tsx
    │   │   └── auth.test.tsx
    │   └── events/
    │       ├── index.ts
    │       ├── components/                     # client (or shared) components
    │       │   ├── event-list.tsx              # "use client": useSuspense hook + table
    │       │   ├── event-form.tsx              # "use client": RHF + zod + generated mutation
    │       │   └── event-status-badge.tsx
    │       ├── server/                         # RSC-only pieces (server-only marked) — optional
    │       │   └── event-og-card.tsx
    │       ├── hooks/
    │       │   └── use-event-filters.ts        # URL-param client state
    │       ├── schemas/
    │       │   └── event-form.schema.ts        # zod schema for the form (not the API)
    │       └── events.test.tsx
    └── test/                       # test setup shared across suites
        ├── setup.ts                # RTL cleanup, jest-dom, MSW server hooks
        ├── msw/
        │   ├── server.ts / browser.ts
        │   └── handlers/           # per-feature request handlers
        └── render.tsx              # renderWithProviders (QueryClient, intl, Suspense)
```

## 2. The Feature Slice, File by File

A slice lives at `src/features/<name>/`. It is the unit an agent scaffolds, reviews, and tests as
a whole — and the unit tracked in `feature_list.json`. Each file:

| File | Ring | Responsibility |
| --- | --- | --- |
| `index.ts` | Feature | Public surface: exports ONLY what `app/` composes (view components, form). Deep imports from outside are lint-banned. |
| `components/<name>.tsx` | Feature | Feature UI; client components carry `"use client"`; consume generated hooks + kernel primitives. Kebab-case file, PascalCase export. |
| `server/<name>.tsx` | Feature | RSC-only pieces (`server-only`), when the slice has them. Optional. |
| `hooks/use-<name>.ts` | Feature | Feature-specific hooks: URL-param state, composed queries, derived logic. |
| `schemas/<name>.schema.ts` | Feature | Zod schema for FORM validation (client rules; the API's shape is already typed by the generated layer). |
| `<name>.test.tsx` | Test | Component test with RTL + MSW against the generated hooks (`09-testing-strategy.md`). |
| `messages/<lng>/<name>.json` | i18n | The feature's translation namespace (`06-i18n.md`). Lives under `messages/`, belongs to the slice. |

The slice's ROUTE lives in `app/` (e.g. `app/(app)/events/page.tsx`) and stays thin: metadata,
rendering decision, prefetch, compose. **Why the split:** App Router owns segment semantics
(layouts, streaming, metadata) by file position — moving those files into `features/` is fighting
the framework; keeping pages thin keeps the slice deletable (delete the feature folder + its
segment folder + one namespace + one d.ts line).

## 3. Repo-Root & Infrastructure Files

| Path | Purpose | Priority |
| --- | --- | --- |
| `AGENTS.md` | Universal agent contract: ring + boundary rules, naming map, exact dev/build/generate/test/lint/arch commands, do/do-not list, "where to add a feature". See `08-ai-agent-first.md`. | Required |
| `CLAUDE.md` | Claude Code entrypoint; thin, links `AGENTS.md` + harness files. | Required |
| `feature_list.json`, `init.sh`, `session-handoff.md`, `claude-progress.md`, `clean-state-checklist.md` | The session harness — state, verification, lifecycle. See `13-harness-engineering.md`. | Required |
| `openapi.json` | Committed API contract; single input to Orval. CI fails if generated output is stale. | Required |
| `orval.config.ts` | `client: 'react-query'`, `httpClient: 'fetch'`, `mode: 'tags-split'`, mutator path, Suspense opts. See `04-data-layer.md`. | Required |
| `next.config.ts` | Rewrites (`/api/be/:path*` → `${API_URL}/:path*` — same-origin API), typedRoutes, image domains. | Required |
| `postcss.config.mjs` | `@tailwindcss/postcss` — Tailwind v4's Next wiring (no Vite plugin here). | Required |
| `tsconfig.json` | `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `resolveJsonModule`, `paths: {"@/*": ["./src/*"]}`. | Required |
| `eslint.config.js` | Flat config: typescript-eslint, react-hooks, boundaries (ring rules §here), no-restricted-imports (fetch/axios outside api/, cross-feature deep imports). | Required |
| `components.json` | shadcn/ui CLI target paths + CSS entry (`src/app/globals.css`). | Required |
| `plopfile.cjs` | Deterministic generators: one command emits an identical, correct feature slice. | Required |
| `.env.example` | `API_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (server) + `NEXT_PUBLIC_*` (public) — every key, no secrets. | Required |
| `scripts/check-architecture.sh` | Belt-and-braces boundary greps + generated-code diff check; runs in CI. | Required |
| `scripts/benchmark.sh`, `scripts/cleanup-scanner.sh` | Bundle-size/Lighthouse budgets; stale-artifact detection. | Prod-only / Optional |
| `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/RELIABILITY.md` | Agent-readable deep docs (update before code when adding features). | Enterprise |
| `e2e/`, `playwright.config.ts` | End-to-end suites (carry MORE weight here — they cover RSC paths RTL cannot; `09-testing-strategy.md`). | Required (Standard+) |

The plop template enforces the slice shape so scaffolding is reproducible:

```bash
# generate a new feature slice (+ its thin segment folder)
pnpm plop feature -- --name events
# regenerate the API layer after the backend spec changes
pnpm generate:api
```

## 4. Shared Kernel — `components/`, `lib/`, `hooks/`

The kernel holds product-agnostic building blocks every feature reuses. Features import the
kernel; the kernel imports nothing from `features/`, `api/generated` models, or `app/`.
Kernel components that are purely presentational stay server-compatible (no `"use client"`
unless they are interactive — shadcn primitives that need it already carry it).

| Path | Contents | Priority |
| --- | --- | --- |
| `components/ui/` | shadcn/ui primitives added via `pnpm dlx shadcn@latest add <component>`; owned and editable, but stay generic. | Required |
| `components/layout/` | Generic structural pieces: `container.tsx`, `page-header.tsx` (server-compatible). | Optional |
| `components/feedback/` | `spinner.tsx`, `error-fallback.tsx`, `empty-state.tsx` — used by boundaries and loaders. | Required |
| `lib/utils.ts` | `cn()` (clsx + tailwind-merge) — created by shadcn init. | Required |
| `lib/format.ts` | `Intl`-based date/number/currency helpers (locale-aware, pairs with i18n). | Optional |
| `i18n/` | next-intl routing/request/navigation wiring (`06-i18n.md`). | Required |
| `hooks/` | `use-debounce.ts`, `use-media-query.ts` — nothing feature-specific. | Optional |
| `stores/` | App-wide client state only (e.g. `theme.store.ts`). If it names a feature, it's in the wrong place. | Optional |
| `types/` | Global augmentations: next-intl `IntlMessages` d.ts (type-safe keys), `env.d.ts`. | Required |

## 5. File-Naming Convention Table

App Router reserved names are the framework's; everything else is **kebab-case** — matching
shadcn/ui CLI output, so generated and hand-written files are uniform. Components export
PascalCase; hooks export camelCase. An agent maps a concept to a filename purely from this
table — the eslint naming rule enforces it.

| Building Block | File Pattern | Example |
| --- | --- | --- |
| Route segment files | reserved: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts` | `app/(app)/events/page.tsx` |
| Route group | `(<group>)/` | `app/(public)/`, `app/(app)/` |
| Dynamic segment | `[<param>]/` | `app/(app)/events/[id]/page.tsx` |
| Middleware | `src/proxy.ts` (Next 16; `middleware.ts` on 15) | locale + auth redirects |
| Component | `<name>.tsx` (kebab) | `event-form.tsx` → `export function EventForm` |
| RSC-only feature piece | `server/<name>.tsx` | `features/events/server/event-og-card.tsx` |
| Hook | `use-<name>.ts(x)` | `use-event-filters.ts` → `useEventFilters` |
| Store (client state) | `<name>.store.ts` | `theme.store.ts` |
| Form/domain schema | `<name>.schema.ts` | `event-form.schema.ts` |
| Context provider | `<name>-provider.tsx` or `providers.tsx` in `app/` | `app/providers.tsx` |
| Generated API (Orval) | `api/generated/<tag>/<tag>.ts` + `model/` | `api/generated/events/events.ts` — never edited |
| Mutator | `custom-fetch.ts` | `api/mutator/custom-fetch.ts` |
| Auth.js config | `src/auth.ts` + `app/api/auth/[...nextauth]/route.ts` | fixed by convention (05) |
| i18n namespace | `messages/<lng>/<ns>.json` | `messages/vi/events.json` |
| Unit/component test | `<name>.test.ts(x)` | `event-form.test.tsx` |
| e2e spec | `e2e/<flow>.spec.ts` | `e2e/create-event.spec.ts` |
| MSW handlers | `test/msw/handlers/<tag>.ts` | `test/msw/handlers/events.ts` |
| Feature public surface | `index.ts` | `features/events/index.ts` |
| Pure util | descriptive `.ts` in `lib/` | `lib/format.ts` |

> **Barrel discipline.** Exactly ONE barrel per feature (`index.ts`, the public surface). No
> nested barrels — they defeat tree-shaking and blur the boundary the lint rule checks.

## 6. Folder-by-Folder Priority Table

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `src/app/layout.tsx` + `providers.tsx` | Bootstrap | html/lang, fonts, QueryProvider island | Required |
| `src/app/(public)/`, `(app)/` | Route groups | thin pages, layouts, loading/error files | Required |
| `src/proxy.ts` | Edge concerns | locale routing, optimistic auth redirects | Required (Standard+) |
| `src/auth.ts` + `app/api/auth/**` | Auth.js v5 | providers, callbacks, session | Required (if auth) |
| `src/api/mutator/` | HTTP adapter | `custom-fetch.ts` (base URL per side, cookies, timeout) | Required |
| `src/api/errors.ts` | Error seam | `mapApiError` — the one seam that reads wire error shapes (04 §3) | Required |
| `src/api/generated/` | Generated port | Orval output per tag + `model/` | Required (machine-owned) |
| `src/components/ui/` | UI primitives | shadcn components | Required |
| `src/components/feedback/` | Boundary UI | error fallback, spinner, empty state | Required |
| `src/lib/`, `src/hooks/` | Pure kernel | cn, format, generic hooks | Required |
| `src/i18n/` | next-intl wiring | routing, request, navigation | Required (Standard+) |
| `src/features/<name>/` | One capability | components, server/, hooks, schemas, tests, index.ts | Required |
| `src/features/auth/` | Session UI | sign-in button, user menu | Required (if auth) |
| `src/stores/`, `src/types/` | App state / global types | theme store, IntlMessages d.ts | Optional / Required |
| `src/test/` | Test plumbing | setup, MSW server + handlers, renderWithProviders | Required |
| `messages/` | Translations | `<lng>/<ns>.json` per feature | Required (Standard+) |
| `e2e/` | User flows + RSC coverage | Playwright specs | Required (Standard+) |
| `docs/` | Deep agent docs | ARCHITECTURE / PRODUCT / RELIABILITY | Enterprise |
| `scripts/` | Guardrails + ops | check-architecture, benchmark, cleanup-scanner | Required / Prod-only |
| Root harness files | Session operating system | AGENTS.md, feature_list.json, init.sh, handoff, checklist | Required |

## Cross-References

- Tailwind v4 tokens, shadcn setup, `components.json`, theming: `03-ui-layer.md`.
- `orval.config.ts` internals, mutator, query/mutation + RSC conventions: `04-data-layer.md`.
- Auth.js config, session models, guards: `05-auth-google.md`.
- next-intl routing/request/navigation, namespaces, typed keys: `06-i18n.md`.
- Per-segment rendering modes, cache ownership, metadata/SEO: `07-rendering-caching.md`.
- ESLint boundaries config, AGENTS.md/CLAUDE.md content, plop templates: `08-ai-agent-first.md`.
- feature_list.json schema, init.sh, checklists, scripts: `13-harness-engineering.md`.

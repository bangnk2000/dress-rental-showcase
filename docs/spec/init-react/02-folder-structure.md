# Folder Structure — Canonical Layout

This file is the single source of truth for WHERE every file lives. Ring responsibilities and the
contents of each building block are detailed in `03-ui-layer.md`, `04-data-layer.md`,
`05-auth-google.md`, `06-i18n.md`, and `07-pwa.md`; this file owns the *tree*, the
*naming convention*, and the *priority* of each path.

The structure is **feature-slice-first** (bulletproof-react lineage): a feature is a mini-app, and
inside it everything that changes together lives together (Common Closure) — components, hooks,
client state, form schemas, translations, tests. Features never import each other; they share the
kernel, the generated API layer, and the TanStack Query cache. Enforce all of this with
eslint-plugin-boundaries + `scripts/check-architecture.sh` (see `08-ai-agent-first.md`).

## Output Scaling

The tree below is a CEILING for a multi-feature production app. Adapt depth to size:

- **Small / 1–2 screens**: one `features/<name>/` with flat files, skip `stores/`, single `common`
  i18n namespace, no PWA. YAGNI applies — see `01-architecture-principles.md`.
- **Standard**: 3–8 features, full `api/` pipeline, auth feature, per-feature namespaces, PWA if
  it earns its keep, full harness.
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
├── vite.config.ts                  # Vite 8: react() + tailwindcss() + VitePWA(...)
├── tsconfig.json                   # strict, path alias @/* → src/*
├── eslint.config.js                # ESLint 9 flat config + boundaries + naming rules
├── plopfile.cjs                    # deterministic feature-slice generator
├── components.json                 # shadcn/ui CLI config (03-ui-layer)
├── playwright.config.ts            # e2e (09-testing-strategy)
├── vitest.config.ts                # unit/component tests (or a `test` block in vite.config)
├── .env.example                    # VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID — keys only
├── index.html
├── docs/                           # agent-readable docs (Enterprise; 13-harness)
│   ├── ARCHITECTURE.md
│   ├── PRODUCT.md
│   └── RELIABILITY.md
├── scripts/
│   ├── check-architecture.sh       # grep/lint boundary checks beyond ESLint
│   ├── benchmark.sh                # bundle size + Lighthouse budget (Prod-only)
│   └── cleanup-scanner.sh          # stale artifacts: orphan files, dead exports
├── public/
│   ├── locales/                    # lazy-loaded translations: {en,vi}/{common,invoices}.json
│   └── pwa-*.png                   # manifest icons (07-pwa)
├── e2e/                            # Playwright specs + fixtures
└── src/
    ├── main.tsx                    # createRoot; imports app/index.css; registers PWA
    ├── app/                        # composition root — outermost ring
    │   ├── index.css               # Tailwind v4 entry: @import "tailwindcss" + @theme tokens
    │   ├── app.tsx                 # <Providers><RouterProvider/></Providers>
    │   ├── providers.tsx           # QueryClient, GoogleOAuth, i18n, Theme, ErrorBoundary
    │   ├── router.tsx              # route tree; lazy route modules; auth guards
    │   ├── layouts/
    │   │   ├── root-layout.tsx     # shell: nav, outlet, toaster, PWA update prompt
    │   │   └── auth-layout.tsx
    │   └── routes/                 # route components that compose features
    │       ├── home-route.tsx
    │       └── not-found-route.tsx
    ├── api/                        # generated API layer — machine-owned port
    │   ├── mutator/
    │   │   └── custom-instance.ts  # THE adapter: axios instance, auth header, 401→refresh
    │   └── generated/              # Orval output (tags-split) — READ-ONLY, regenerate only
    │       ├── invoices/invoices.ts        # useListInvoices, useCreateInvoice, keys…
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
    │   ├── i18n.ts                 # i18next init (06-i18n)
    │   └── format.ts               # date/number/currency via Intl
    ├── hooks/                      # generic reusable hooks (use-debounce.ts, use-media-query.ts)
    ├── stores/                     # app-wide client state ONLY (theme.store.ts) — rare
    ├── types/                      # global TS types/augmentations (i18next.d.ts lives here)
    ├── features/
    │   ├── auth/                   # feature == vertical slice == mini-app
    │   │   ├── index.ts            # PUBLIC SURFACE — the only import path for outsiders
    │   │   ├── components/
    │   │   │   ├── google-sign-in-button.tsx
    │   │   │   └── require-auth.tsx          # route guard wrapper
    │   │   ├── hooks/
    │   │   │   └── use-session.ts            # session context consumer
    │   │   ├── session-provider.tsx          # session context (05-auth-google)
    │   │   └── auth.test.tsx
    │   └── invoices/
    │       ├── index.ts
    │       ├── components/
    │       │   ├── invoice-list.tsx          # useSuspenseListInvoices + table
    │       │   ├── invoice-form.tsx          # RHF + zodResolver + useCreateInvoice
    │       │   └── invoice-status-badge.tsx
    │       ├── hooks/
    │       │   └── use-invoice-filters.ts    # URL-param client state
    │       ├── schemas/
    │       │   └── invoice-form.schema.ts    # zod schema for the form (not the API)
    │       ├── stores/                       # only if it earns its keep
    │       └── invoices.test.tsx
    └── test/                       # test setup shared across suites
        ├── setup.ts                # RTL cleanup, jest-dom, MSW server hooks
        ├── msw/
        │   ├── server.ts / browser.ts
        │   └── handlers/           # per-feature request handlers
        └── render.tsx              # renderWithProviders (QueryClient, i18n, Router)
```

## 2. The Feature Slice, File by File

A slice lives at `src/features/<name>/`. It is the unit an agent scaffolds, reviews, and tests as
a whole — and the unit tracked in `feature_list.json`. Each file:

| File | Ring | Responsibility |
| --- | --- | --- |
| `index.ts` | Feature | Public surface: exports ONLY what `app/` composes (route component, guard). Deep imports from outside are lint-banned. |
| `components/<name>.tsx` | Feature | Feature UI; consumes generated hooks + kernel primitives. Kebab-case file, PascalCase export. |
| `hooks/use-<name>.ts` | Feature | Feature-specific hooks: URL-param state, composed queries, derived logic. |
| `schemas/<name>.schema.ts` | Feature | Zod schema for FORM validation (client rules; the API's shape is already typed/validated by the generated layer). |
| `stores/<name>.store.ts` | Feature | Client state shared across distant components (zustand). Optional — most features have none. |
| `<name>.test.tsx` | Test | Component test with RTL + MSW against the generated hooks (`09-testing-strategy.md`). |
| `public/locales/<lng>/<name>.json` | i18n | The feature's translation namespace (`06-i18n.md`). Lives under `public/`, belongs to the slice. |

**Why a slice colocates UI + state + schema + tests:** the form, its validation, its mutation
wiring, and its translations all change together when the product changes. Colocating them follows
Common Closure and lets an agent add a capability by touching exactly one folder (plus a route line
in `app/router.tsx` and a `feature_list.json` entry). The slice still respects the dependency rule —
it imports the kernel and `api/`, and nothing imports outward.

## 3. Repo-Root & Infrastructure Files

| Path | Purpose | Priority |
| --- | --- | --- |
| `AGENTS.md` | Universal agent contract: ring + dependency rules, naming map, exact dev/build/generate/test/lint/arch commands, do/do-not list, "where to add a feature". See `08-ai-agent-first.md`. | Required |
| `CLAUDE.md` | Claude Code entrypoint; thin, links `AGENTS.md` + harness files. | Required |
| `feature_list.json`, `init.sh`, `session-handoff.md`, `claude-progress.md`, `clean-state-checklist.md` | The session harness — state, verification, lifecycle. See `13-harness-engineering.md`. | Required |
| `openapi.json` | Committed API contract; single input to Orval. CI fails if generated output is stale. | Required |
| `orval.config.ts` | `client: 'react-query'`, `httpClient: 'axios'`, `mode: 'tags-split'`, mutator path, Suspense opts. See `04-data-layer.md`. | Required |
| `vite.config.ts` | Vite 8 + `@vitejs/plugin-react` 6 + `@tailwindcss/vite` + `vite-plugin-pwa`; `resolve.alias` `@ → src`. | Required |
| `tsconfig.json` | `strict: true`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `paths: {"@/*": ["./src/*"]}`. | Required |
| `eslint.config.js` | Flat config: typescript-eslint, react-hooks, boundaries (ring rules §here), no-restricted-imports (axios outside api/, cross-feature deep imports). | Required |
| `components.json` | shadcn/ui CLI target paths + Tailwind CSS entry. | Required |
| `plopfile.cjs` | Deterministic generators: one command emits an identical, correct feature slice. | Required |
| `.env.example` | `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` — every key, no secrets. | Required |
| `scripts/check-architecture.sh` | Belt-and-braces boundary greps + generated-code diff check; runs in CI. | Required |
| `scripts/benchmark.sh`, `scripts/cleanup-scanner.sh` | Bundle-size/Lighthouse budgets; stale-artifact detection. | Prod-only / Optional |
| `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/RELIABILITY.md` | Agent-readable deep docs (update before code when adding features). | Enterprise |
| `e2e/`, `playwright.config.ts` | End-to-end suites. | Required (Standard+) |

The plop template enforces the slice shape so scaffolding is reproducible:

```bash
# generate a new feature slice
pnpm plop feature -- --name invoices
# regenerate the API layer after the backend spec changes
pnpm generate:api
```

## 4. Shared Kernel — `components/`, `lib/`, `hooks/`

The kernel holds product-agnostic building blocks every feature reuses. Features import the kernel;
the kernel imports nothing from `features/`, `api/generated` models, or `app/`.

| Path | Contents | Priority |
| --- | --- | --- |
| `components/ui/` | shadcn/ui primitives added via `pnpm dlx shadcn@latest add <component>`; owned and editable, but stay generic. | Required |
| `components/layout/` | Generic structural pieces: `container.tsx`, `page-header.tsx`. | Optional |
| `components/feedback/` | `spinner.tsx`, `error-fallback.tsx`, `empty-state.tsx` — used by boundaries and loaders. | Required |
| `lib/utils.ts` | `cn()` (clsx + tailwind-merge) — created by shadcn init. | Required |
| `lib/i18n.ts` | i18next initialization (imported once in `main.tsx`). | Required |
| `lib/format.ts` | `Intl`-based date/number/currency helpers (locale-aware, pairs with i18n). | Optional |
| `hooks/` | `use-debounce.ts`, `use-media-query.ts` — nothing feature-specific. | Optional |
| `stores/` | App-wide client state only (e.g. `theme.store.ts`). If it names a feature, it's in the wrong place. | Optional |
| `types/` | Global augmentations: `i18next.d.ts` (type-safe keys), `env.d.ts`. | Required |

## 5. File-Naming Convention Table

Directories and files are **kebab-case** — matching shadcn/ui CLI output, so generated and
hand-written files are uniform. Components export PascalCase; hooks export camelCase. An agent maps
a concept to a filename purely from this table — the eslint naming rule enforces it.

| Building Block | File Pattern | Example |
| --- | --- | --- |
| Component | `<name>.tsx` (kebab) | `invoice-form.tsx` → `export function InvoiceForm` |
| Route component | `<name>-route.tsx` | `app/routes/home-route.tsx` |
| Layout | `<name>-layout.tsx` | `app/layouts/root-layout.tsx` |
| Hook | `use-<name>.ts(x)` | `use-invoice-filters.ts` → `useInvoiceFilters` |
| Store (client state) | `<name>.store.ts` | `theme.store.ts` |
| Form/domain schema | `<name>.schema.ts` | `invoice-form.schema.ts` |
| Context provider | `<name>-provider.tsx` | `session-provider.tsx` |
| Guard/wrapper | descriptive `.tsx` | `require-auth.tsx` |
| Generated API (Orval) | `api/generated/<tag>/<tag>.ts` + `model/` | `api/generated/invoices/invoices.ts` — never edited |
| Mutator | `custom-instance.ts` | `api/mutator/custom-instance.ts` |
| i18n namespace | `public/locales/<lng>/<ns>.json` | `public/locales/vi/invoices.json` |
| Unit/component test | `<name>.test.ts(x)` | `invoice-form.test.tsx` |
| e2e spec | `e2e/<flow>.spec.ts` | `e2e/create-invoice.spec.ts` |
| MSW handlers | `test/msw/handlers/<tag>.ts` | `test/msw/handlers/invoices.ts` |
| Feature public surface | `index.ts` | `features/invoices/index.ts` |
| Pure util | descriptive `.ts` in `lib/` | `lib/format.ts` |

> **Barrel discipline.** Exactly ONE barrel per feature (`index.ts`, the public surface). No nested
> barrels — they defeat tree-shaking and blur the boundary the lint rule checks.

## 6. Folder-by-Folder Priority Table

| Path | Purpose | Typical Contents | Priority |
| --- | --- | --- | --- |
| `src/main.tsx` | Bootstrap | createRoot, css import, PWA register, i18n import | Required |
| `src/app/` | Composition root | providers, router, layouts, routes, index.css | Required |
| `src/api/mutator/` | HTTP adapter | `custom-instance.ts` (auth, refresh, errors) | Required |
| `src/api/generated/` | Generated port | Orval output per tag + `model/` | Required (machine-owned) |
| `src/components/ui/` | UI primitives | shadcn components | Required |
| `src/components/feedback/` | Boundary UI | error fallback, spinner, empty state | Required |
| `src/lib/`, `src/hooks/` | Pure kernel | cn, i18n init, format, generic hooks | Required |
| `src/features/<name>/` | One capability | components, hooks, schemas, stores, tests, index.ts | Required |
| `src/features/auth/` | Session + guards | Google sign-in, session provider, require-auth | Required (if auth) |
| `src/stores/`, `src/types/` | App state / global types | theme store, i18next.d.ts | Optional / Required |
| `src/test/` | Test plumbing | setup, MSW server + handlers, renderWithProviders | Required |
| `public/locales/` | Translations | `<lng>/<ns>.json` per feature | Required (Standard+) |
| `e2e/` | User flows | Playwright specs | Required (Standard+) |
| `docs/` | Deep agent docs | ARCHITECTURE / PRODUCT / RELIABILITY | Enterprise |
| `scripts/` | Guardrails + ops | check-architecture, benchmark, cleanup-scanner | Required / Prod-only |
| Root harness files | Session operating system | AGENTS.md, feature_list.json, init.sh, handoff, checklist | Required |

## Cross-References

- Tailwind v4 tokens, shadcn setup, `components.json`, theming: `03-ui-layer.md`.
- `orval.config.ts` internals, mutator, query/mutation conventions: `04-data-layer.md`.
- Session provider, guards, Google flows: `05-auth-google.md`.
- Namespace layout, lazy loading, type-safe keys: `06-i18n.md`.
- `vite-plugin-pwa` config and update UX: `07-pwa.md`.
- ESLint boundaries config, AGENTS.md/CLAUDE.md content, plop templates: `08-ai-agent-first.md`.
- feature_list.json schema, init.sh, checklists, scripts: `13-harness-engineering.md`.

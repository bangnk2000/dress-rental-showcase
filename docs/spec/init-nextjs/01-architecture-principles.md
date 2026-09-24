# Architecture Principles

This file defines the architectural foundations every feature in this codebase obeys:
**feature-based vertical slicing** + **unidirectional dependencies** + **generated API boundary** +
**server-state/client-state separation** + **an explicit server/client component boundary**,
adapted to be AI-agent-first. It is the contract an AI coding agent reads before generating or
modifying code.

- For the on-disk layout that realizes these rings, see `02-folder-structure.md`.
- For the building blocks: `03-ui-layer.md` (UI kernel), `04-data-layer.md` (generated API +
  TanStack Query), `05-auth-google.md`, `06-i18n.md`, `07-rendering-caching.md`.
- For how these rules are machine-enforced (eslint-plugin-boundaries, check-architecture.sh,
  scaffolding), see `08-ai-agent-first.md` and `13-harness-engineering.md`.

**Output-Scaling note:** the full ceremony below is a CEILING. A small project SKIPs route
groups, per-feature namespaces, and rendering machinery it does not need (see "Pragmatism /
YAGNI"). Scale depth to the product's real complexity, not to this document's length.

## 1. The Four Rings

A **feature == a vertical slice == a mini-app** bounded by one product capability. Around the
features sit three more rings. Dependencies point **inward** (toward the shared kernel); outer
rings know inner rings, never the reverse.

| Ring | One-line responsibility | May import | Lives in |
| --- | --- | --- | --- |
| **Shared kernel** (innermost) | Reusable UI primitives, pure utilities, generic hooks — zero product knowledge. | Only itself + third-party libs. | `src/components/ui/`, `src/lib/`, `src/hooks/`, `src/types/` |
| **API layer** | Generated fetch functions + TanStack Query hooks + models from `openapi.json`; ONE isomorphic mutator for cross-cutting HTTP concerns. | Shared kernel (`lib/`) only. | `src/api/` |
| **Features** | Product capabilities: server + client components, feature hooks, form schemas, i18n namespace. | Shared kernel + API layer. NEVER another feature. | `src/features/<name>/` |
| **App** (outermost) | Composition root: route segments, layouts, route groups, `error.tsx`/`loading.tsx`, metadata, providers, `proxy.ts`. | Everything below. Nothing imports it. | `src/app/` (+ `src/proxy.ts`) |

Notes:
- **`app/` is thin.** A `page.tsx` composes feature components, decides the rendering mode
  (`07-rendering-caching.md`), exports metadata, and nothing else. Logic in a page is a smell —
  it belongs in the feature.
- The **shared kernel has ZERO product knowledge** — a `Button` or `formatDate()` must make sense
  in any app. The moment something knows about "events", it belongs in `features/events/`.
- The **API layer is machine-owned**: `src/api/generated/**` is emitted by Orval and is read-only
  for humans and agents alike. The only hand-written files are the mutator, `src/api/errors.ts`
  (the error seam, 04 §3), and (optionally) thin server helpers. See `04-data-layer.md`.

## 2. The Dependency Rule (inward only)

> Source code dependencies point only **inward**. An inner ring NEVER names anything in an outer ring.

```
            ┌──────────────────────────────────────────────────┐
            │                 app/  (route segments)           │
            │  (public)/ · (app)/ · layout.tsx · error.tsx ·   │
            │  loading.tsx · metadata · providers · proxy.ts   │
            │        ┌────────────────────────────────────┐    │
            │        │        features/<name>/            │    │
 segments → │        │  server + client components ·      │    │
            │        │  hooks · schemas · i18n namespace  │    │
            │        │   ┌──────────────┬─────────────┐   │    │
            │        │   │ shared kernel│   api/      │   │    │
            │        │   │ components/ui│  generated  │   │    │
            │        │   │ lib · hooks  │  + mutator  │   │    │
            │        │   └──────────────┴─────────────┘   │    │
            │        └────────────────────────────────────┘    │
            └──────────────────────────────────────────────────┘
                 dependency arrows ALL point INWARD ────────►
```

- `app/` may import features (to build pages); a feature may import the kernel and `api/`;
  the kernel and `api/` import nothing above them.
- **No feature imports another feature.** Cross-feature needs are met by (a) promoting the shared
  piece into the kernel, (b) composing both features in an `app/` page/layout, or (c) sharing
  server state through the query cache (both call the same generated hook — the cache deduplicates).
- All of this is **[CI]-enforced** by eslint-plugin-boundaries and `scripts/check-architecture.sh`
  (see `08-ai-agent-first.md`); a violation fails the build.

## 3. Who May Import Whom

Allowed (`✓`) / forbidden (`✗`). Rows = importer, columns = imported. Cells marked **[CI]** are
machine-enforced.

| Importer ↓ \ Imported → | `components/ui`, `lib`, `hooks` | `api/generated` | `api/mutator` | `features/<own>` | `features/<other>` | `app/` |
| --- | --- | --- | --- | --- | --- | --- |
| **Shared kernel** | ✓ | ✗ **[CI]** | ✗ **[CI]** | ✗ **[CI]** | ✗ **[CI]** | ✗ **[CI]** |
| **api/** | ✓ (`lib` only) | ✓ | ✓ | ✗ **[CI]** | ✗ **[CI]** | ✗ **[CI]** |
| **features/<name>** | ✓ | ✓ | ✗ (only Orval wires it) | ✓ | ✗ **[CI]** | ✗ **[CI]** |
| **app/** | ✓ | ✓ (RSC calls + prefetch) | ✓ (QueryClient defaults) | ✓ | ✓ | ✓ |

`src/api/errors.ts` sits in the `api/` element and follows the `api/generated` column: any
feature may import it — `mapApiError` is the surface components branch on (04 §3); the kernel
may not.

Key forbidden edges, all **[CI]**-enforced:
- **Kernel → anything outer** — the cardinal rule. A `components/ui` file importing from
  `features/` means the primitive was never generic; move it.
- **Feature → feature** — the slice boundary. Use kernel promotion, app-level composition, or the
  query cache instead.
- **Anything → `app/`** — the composition root is a consumer, never a dependency.
- **Anyone editing `api/generated/**`** — regenerate instead (`pnpm generate:api`); CI diffs it
  against the spec.

## 4. Server State vs Client State (the CQRS of the frontend)

The single most load-bearing discipline in this architecture:

- **Server state** (anything fetched from the API) has exactly ONE cache owner per surface
  (`07-rendering-caching.md` §2): authenticated/interactive surfaces → the TanStack Query cache
  (server-prefetched, hydrated, then client-owned) through generated hooks; public cacheable
  surfaces → an RSC call through the generated fetch function, cached by Next with explicit tags.
  Server data is never copied into `useState`, `useReducer`, or a store. Reads are queries;
  writes are mutations that **invalidate** the affected queries (and `revalidateTag` when a
  public cached page shows the same data). See `04-data-layer.md`.
- **Client state** (UI state: open dialogs, wizard step, unsaved form input, theme) lives in React
  (`useState`, context) or the URL (`useSearchParams` — shareable filters/tabs/pagination).
  A store (zustand) only when state must outlive a component tree AND is shared across many
  components. One store per feature, max — most features need zero.
- **Derived state is computed, not stored.** If it can be computed from query data + client state
  during render (or via `select` on the query), do that.

> RULE: if you find yourself writing `useEffect(() => setX(data), [data])`, stop — you are copying
> server state. Read it from the hook where you need it.

## 5. The Server/Client Boundary (Next.js's extra dimension)

Rings say *who imports whom*; this rule says *where code runs*. Both must hold.

- **Server Components are the default.** A file gets `"use client"` only because it needs state,
  effects, event handlers, or browser APIs — and the directive goes on the interactive LEAF, not
  on the page. Pushing `"use client"` up a tree drags the whole subtree into the bundle.
- **Mark intent with packages, not comments**: modules that touch secrets, `next/headers`, or the
  DB of a future BFF import `server-only`; modules that touch `window` import `client-only`.
  A wrong-side import then fails the BUILD, not a code review. The mutator is deliberately
  isomorphic (neither marker) — it is the one file that adapts per side (04 §3).
- **Props crossing the boundary must be serializable.** No functions, class instances, or Dates
  you expect back intact. If a client component needs behavior, it owns it or receives a
  Server-Action reference — never a closure.
- **Secrets live on the server.** `API_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_SECRET` are server env;
  anything the browser needs is `NEXT_PUBLIC_*` and is public by definition. An LLM or API key in
  `NEXT_PUBLIC_*` is a leak, full stop (`08-ai-agent-first.md` §5).
- **Features may split internally**: `features/<name>/components/` (client or shared) and
  `features/<name>/server/` (RSC-only pieces, `server-only`-marked). The feature's `index.ts`
  public surface may export both; `app/` composes them per segment.

## 6. Error Handling Discipline

- **Expected request failures are STATE, not exceptions.** An expected mutation failure — a
  business outcome (`rejected_*`) or a validation fault with `details[]` — surfaces through the
  mutation's `error` and is mapped to UI: a form field message, a toast, an inline alert. Client
  zod catches malformed input before a request is sent; business outcomes (422) are server truth
  no client validation can pre-empt — each outcome code gets a designed state (14 §2 template §4).
- **Unexpected failures are caught by segment boundaries.** Each route segment has `error.tsx`
  (and `loading.tsx`/`<Suspense>` for streaming); the QueryClient's `throwOnError` policy routes
  unrecoverable query errors (5xx, network) to it. `global-error.tsx` is the last resort.
  In an RSC, a failed generated call throws server-side and the same `error.tsx` renders.
- **401 is handled ONCE**, at the seam: the mutator/auth module refreshes or redirects
  (`05-auth-google.md` §4). Components never inspect status codes — they branch on `mapApiError`
  output (04 §3).
- Rule of thumb: *if the user can act on it, render it; if not, throw to the boundary.*

## 7. Naming & Idiom Discipline

- App Router reserved names are fixed by the framework: `page.tsx`, `layout.tsx`, `loading.tsx`,
  `error.tsx`, `not-found.tsx`, `route.ts`, `proxy.ts` (Next 16's name for `middleware.ts`).
  Everything else is **kebab-case** (`login-form.tsx` exports `LoginForm`) — matching shadcn CLI
  output. Full map in `02-folder-structure.md` §5.
- Every feature exposes a **public surface** via `index.ts`; `app/` imports
  `@/features/events`, never a deep path — deep imports across the boundary are lint-banned.
- User-facing strings go through next-intl (`useTranslations`/`getTranslations`) with a
  per-feature namespace (`06-i18n.md`). Hardcoded strings in JSX are a smell.

## 8. Pragmatism / YAGNI — when to SKIP

The architecture is a ceiling. **Do not over-engineer small projects.** Apply the lightest
structure that still upholds the Dependency Rule.

- **Route groups:** one `(app)` group is enough until you have a real public/authenticated split.
- **`features/<name>/server/`:** only when a slice actually has RSC-only logic; most slices are
  a client component tree fed by a server page.
- **Stores:** most features need zero. URL state (`useSearchParams`) covers filters/tabs/paging.
- **Feature subfolders:** a feature with two components does not need `components/`, `hooks/`,
  `schemas/` folders — flat files are fine until ~5 files.
- **Caching:** dynamic-by-default is correct for an authenticated app; introduce Next Data Cache
  tags only for public surfaces that earn them (`07-rendering-caching.md` §4). Premature caching
  is the App Router's sharpest footgun.
- **Server Actions:** optional machinery (04 §7). Default to generated client mutations; reach
  for an action only when the write must touch server-only state (cookies, `revalidateTag`).
- **i18n:** one language today → still use next-intl `t()` from day one (retrofitting is brutal),
  but a single `common` namespace and no locale prefix are fine until features grow.

The rules you NEVER skip, at any size: **the Dependency Rule, the server/client boundary rules,
no hand-edits to generated code, and no server state in stores** — they are CI-enforced.
Everything else scales with the product.

## 9. Smells / Violations — agent self-check

Before finishing a change, an agent should confirm NONE of these are present:

- An import from `features/<a>` inside `features/<b>`, or any import of `app/` outside `app/`.
- A hand edit inside `src/api/generated/**` (fix the spec or the Orval config, then regenerate).
- `fetch`/`axios` called in a component, or a URL string built outside the API layer.
- `"use client"` on a page/layout that only composes; or a whole feature turned client because
  one leaf needed a click handler.
- `next/headers`, server env, or `auth()` imported into a client component; a secret in
  `NEXT_PUBLIC_*`; a `server-only` marker missing on a module that reads secrets.
- The same data cached by BOTH Next's Data Cache and TanStack Query (two freshness owners).
- `useEffect` copying query data into `useState`/a store; server data living in zustand.
- A component inspecting `error.response.status`/`res.status` — components branch on
  `mapApiError` output (04 §3); 401/403 logic belongs to the seam.
- A `components/ui/` file importing from `features/` or knowing a domain word.
- Hardcoded user-facing text in JSX where a `t('<key>')` belongs.
- A new feature slice without: `index.ts` public surface, i18n namespace, a test, and a
  `feature_list.json` entry (`13-harness-engineering.md`).
- A page without a stated rendering decision where data is involved (`07-rendering-caching.md` §1).

If any smell is present, the layering is broken — fix it before relying on CI. See
`08-ai-agent-first.md` for the guardrails that will otherwise reject the change.

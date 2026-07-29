# Architecture Principles

This file defines the architectural foundations every feature in this codebase obeys:
**feature-based vertical slicing** + **unidirectional dependencies** + **generated API boundary** +
**server-state/client-state separation**, adapted to be AI-agent-first. It is the contract an AI
coding agent reads before generating or modifying code.

- For the on-disk layout that realizes these rings, see `02-folder-structure.md`.
- For the building blocks: `03-ui-layer.md` (UI kernel), `04-data-layer.md` (generated API +
  TanStack Query), `05-auth-google.md`, `06-i18n.md`, `07-pwa.md`.
- For how these rules are machine-enforced (eslint-plugin-boundaries, check-architecture.sh,
  scaffolding), see `08-ai-agent-first.md` and `13-harness-engineering.md`.

**Output-Scaling note:** the full ceremony below is a CEILING. A small project SKIPs stores,
per-feature namespaces, and PWA machinery it does not need (see "Pragmatism / YAGNI"). Scale depth
to the product's real complexity, not to this document's length.

## 1. The Four Rings

A **feature == a vertical slice == a mini-app** bounded by one product capability. Around the
features sit three more rings. Dependencies point **inward** (toward the shared kernel); outer
rings know inner rings, never the reverse.

| Ring | One-line responsibility | May import | Lives in |
| --- | --- | --- | --- |
| **Shared kernel** (innermost) | Reusable UI primitives, pure utilities, generic hooks — zero product knowledge. | Only itself + third-party libs. | `src/components/ui/`, `src/lib/`, `src/hooks/`, `src/types/` |
| **API layer** | Generated TanStack Query hooks + models from `openapi.json`; ONE mutator for cross-cutting HTTP concerns. | Shared kernel (`lib/`) only. | `src/api/` |
| **Features** | Product capabilities: components, feature hooks, client state, form schemas, i18n namespace. | Shared kernel + API layer. NEVER another feature. | `src/features/<name>/` |
| **App** (outermost) | Composition root: providers, router, layouts, global error boundary. | Everything below. Nothing imports it. | `src/app/` |

Notes:
- The **shared kernel has ZERO product knowledge** — a `Button` or `formatDate()` must make sense
  in any app. The moment something knows about "invoices", it belongs in `features/invoices/`.
- The **API layer is machine-owned**: `src/api/generated/**` is emitted by Orval and is read-only
  for humans and agents alike. The only hand-written files are the mutator and (optionally) thin
  query-key helpers. See `04-data-layer.md`.

## 2. The Dependency Rule (inward only)

> Source code dependencies point only **inward**. An inner ring NEVER names anything in an outer ring.

```
            ┌───────────────────────────────────────────────┐
            │                    app/                        │
            │   providers.tsx · router.tsx · layouts ·      │
            │   global error boundary · PWA update toast    │
            │        ┌─────────────────────────────────┐    │
            │        │        features/<name>/         │    │
  routes →  │        │  components · hooks · stores ·  │    │
            │        │  schemas · i18n namespace       │    │
            │        │   ┌──────────────┬───────────┐  │    │
            │        │   │ shared kernel│  api/     │  │    │
            │        │   │ components/ui│ generated │  │    │
            │        │   │ lib · hooks  │ + mutator │  │    │
            │        │   └──────────────┴───────────┘  │    │
            │        └─────────────────────────────────┘    │
            └───────────────────────────────────────────────┘
                 dependency arrows ALL point INWARD ────────►
```

- `app/` may import features (to build the route tree); a feature may import the kernel and `api/`;
  the kernel and `api/` import nothing above them.
- **No feature imports another feature.** Cross-feature needs are met by (a) promoting the shared
  piece into the kernel, (b) composing both features in `app/` (a route/layout renders both), or
  (c) sharing server state through TanStack Query's cache (both call the same generated hook —
  the cache deduplicates).
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
| **app/** | ✓ | ✓ (prefetch only) | ✓ (QueryClient defaults) | ✓ | ✓ | ✓ |

Key forbidden edges, all **[CI]**-enforced:
- **Kernel → anything outer** — the cardinal rule. A `components/ui` file importing from
  `features/` means the primitive was never generic; move it.
- **Feature → feature** — the slice boundary. Use kernel promotion, app-level composition, or the
  query cache instead.
- **Anything → `app/`** — the composition root is a consumer, never a dependency.
- **Anyone editing `api/generated/**`** — regenerate instead (`pnpm generate:api`); the folder is
  in `.eslintignore`-style read-only guard and CI diffs it against the spec.

## 4. Server State vs Client State (the CQRS of the frontend)

The single most load-bearing discipline in this architecture:

- **Server state** (anything fetched from the API) lives ONLY in the TanStack Query cache, accessed
  through Orval-generated hooks. It is never copied into `useState`, `useReducer`, or a store.
  Reads are queries; writes are mutations that **invalidate** the affected queries (or set cache
  data directly for optimistic updates). See `04-data-layer.md`.
- **Client state** (UI state: open dialogs, wizard step, unsaved form input, theme) lives in React
  (`useState`, context) or — only when it must outlive a component tree or is shared across many
  components — a small store (`<feature>.store.ts`, zustand). One store per feature, max.
- **Derived state is computed, not stored.** If it can be computed from query data + client state
  during render (or via `select` on the query), do that.

> RULE: if you find yourself writing `useEffect(() => setX(data), [data])`, stop — you are copying
> server state. Read it from the hook where you need it.

## 5. The Generated API Boundary (ports & adapters, React edition)

- `openapi.json` is the **contract**; Orval-generated hooks/models are the **port**; the single
  **mutator** (`custom-instance.ts`, an Axios instance) is the **adapter** where every cross-cutting
  HTTP concern lives: base URL, `Authorization` header injection, 401 → refresh-and-retry, error
  normalization. Swapping auth schemes or API hosts touches ONE file.
- Components never call `fetch`/`axios` directly and never build URLs — **[CI]**-enforced (an
  import ban on `axios` outside `src/api/`). If an endpoint is missing, fix the OpenAPI spec and
  regenerate; do not hand-roll a request.
- Regeneration is deterministic and repeatable: `pnpm generate:api` in dev, verified in CI (the
  build fails if generated output is stale relative to the committed spec). See `04-data-layer.md`.

## 6. Error Handling Discipline

- **Expected request failures are STATE, not exceptions.** A 4xx from a mutation (validation
  conflict, forbidden) surfaces through the mutation's `error` and is mapped to UI: a form field
  message, a toast, an inline alert. Zod-validated forms catch most 400s before they happen.
- **Unexpected failures are caught by boundaries.** Each route has an error boundary (paired with
  Suspense when using `useSuspenseQuery`); the QueryClient's `throwOnError` policy routes
  unrecoverable query errors (5xx, network) to it. A global boundary in `app/` is the last resort.
- **401 is handled ONCE**, in the mutator: attempt refresh, retry the request, and on failure
  clear the session and redirect to sign-in. Components never inspect status codes.
- Rule of thumb: *if the user can act on it, render it; if not, throw to the boundary.*

## 7. Naming & Idiom Discipline

- Directories and files are **kebab-case** (`login-form.tsx` exports `LoginForm`) — matching what
  the shadcn CLI generates, so hand-written and CLI-added files are indistinguishable. Full map in
  `02-folder-structure.md` §5.
- Every feature exposes a **public surface** via `index.ts`; `app/` imports
  `@/features/invoices`, never a deep path — deep imports across the boundary are lint-banned.
- User-facing strings go through `t()` with a per-feature namespace (`06-i18n.md`). Hardcoded
  strings in JSX are a smell the i18n lint rule catches.

## 8. Pragmatism / YAGNI — when to SKIP

The architecture is a ceiling. **Do not over-engineer small projects.** Apply the lightest
structure that still upholds the Dependency Rule.

- **Stores:** most features need zero. Add `<feature>.store.ts` only for client state genuinely
  shared across distant components. Never for server data.
- **Feature subfolders:** a feature with two components does not need `components/`, `hooks/`,
  `schemas/` folders — flat files are fine until ~5 files.
- **Suspense:** default to route-level `useSuspenseQuery` for primary data; but a widget that can
  render a skeleton independently may use classic `isPending` — don't force one pattern.
- **i18n:** one language today → still use `t()` from day one (retrofitting is brutal), but a
  single `common` namespace is fine until features grow.
- **PWA:** skip entirely unless installability/offline is a real requirement; a half-configured
  service worker causes stale-cache bugs that cost more than it gives.
- **Optimistic updates:** invalidate-on-success is the default; optimistic cache writes only where
  latency genuinely hurts UX.

The rules you NEVER skip, at any size: **the Dependency Rule, no hand-edits to generated code, and
no server state in stores** — they are CI-enforced. Everything else scales with the product.

## 9. Smells / Violations — agent self-check

Before finishing a change, an agent should confirm NONE of these are present:

- An import from `features/<a>` inside `features/<b>`, or any import of `app/` outside `app/`.
- A hand edit inside `src/api/generated/**` (fix the spec or the Orval config, then regenerate).
- `axios`/`fetch` imported in a component, or a URL string built outside the API layer.
- `useEffect` copying query data into `useState`/a store; server data living in zustand.
- A component inspecting `error.response.status` (401/403 logic belongs in the mutator/guards).
- A `components/ui/` file importing from `features/` or knowing a domain word.
- Hardcoded user-facing text in JSX where a `t('<ns>:<key>')` belongs.
- `tailwind.config.js` reappearing, or theme values hardcoded in class names instead of `@theme`
  tokens (`03-ui-layer.md`).
- A new feature slice without: `index.ts` public surface, i18n namespace, a test, and a
  `feature_list.json` entry (`13-harness-engineering.md`).
- Precaching API responses in the service worker, or `registerType` chosen implicitly (`07-pwa.md`).

If any smell is present, the layering is broken — fix it before relying on CI. See
`08-ai-agent-first.md` for the guardrails that will otherwise reject the change.

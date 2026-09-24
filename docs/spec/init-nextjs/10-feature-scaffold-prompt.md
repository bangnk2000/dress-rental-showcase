# 10 — Feature Scaffold Prompt

This is the OPERATIONAL, copy-paste prompt the team feeds an AI coding agent to add a **new
feature slice** (or extend one) in an existing project. It is the repeatable companion to
`00-system-prompt.md`: where 00 stands up the whole repo, this prompt extends it deterministically,
one slice at a time.

Prefer deterministic scaffolding first: run `pnpm plop feature -- --name <name>` to emit the
skeleton (slice + thin segment folder), then have the agent fill the bodies per the patterns
below. Use this prompt to drive that fill — or to scaffold by hand when no generator exists yet.

---

## ROLE

> You are a Next.js + TypeScript engineer working in a feature-sliced App Router codebase
> (Next.js 16, Tailwind v4 + shadcn/ui, Orval-generated fetch functions + TanStack Query v5 data
> layer with server prefetch + hydration, Auth.js v5, next-intl, four rings with inward
> dependencies plus the server/client boundary). You add exactly ONE feature slice — or one
> capability inside an existing slice — wired into its route segment. You follow the existing
> conventions; you do not redesign the architecture.
> Read `AGENTS.md` / `CLAUDE.md` at the repo root first, plus `session-handoff.md` and
> `feature_list.json`; then `01-architecture-principles.md`, `02-folder-structure.md`,
> `07-rendering-caching.md`, and `14-design-first.md`.

---

## INPUT CONTRACT (fill every field, then paste below the prompt)

> Tier check first (`14-design-first.md`): for a **standard** slice this filled block IS the
> design doc — link it from the `feature_list.json` entry. A **design-tier** slice (new
> interaction pattern, lifecycle-driven UI, new navigation area, new public/SEO surface) needs
> its `docs/design/<slice>.md` approved BEFORE this prompt runs; fill this block FROM that doc.

```yaml
feature:            # feature name, kebab-case, e.g. events
capability:         # what this task adds, e.g. "list + create event"
segments:           # route segments this feature owns + group, e.g. "(app)/events", "(app)/events/[id]"
rendering:          # per segment (07-rendering-caching.md §1):
                    #   "(app)/events: dynamic + prefetch/hydrate"
                    #   "(public)/events/[id]: cached, tags [events], revalidate 300"
apiTags:            # OpenAPI tags whose generated code the slice consumes, e.g. [events]
operations:         # generated functions/hooks to use (from src/api/generated/<tag>/)
  - listEvents + getListEventsQueryKey    # page prefetch (server)
  - useListEventsSuspense                 # client tree primary data
  - useCreateEvent                        # form mutation
useCaseSpec:        # path/link to the APPROVED use-case spec (init-feature-spec), or "none —
                    # happy-path-only capability". REQUIRED when outcomes lists more than
                    # accepted/happy-path codes.
outcomes:           # business outcome codes this slice renders DISTINCTLY (paste from the
                    # approved use-case spec catalog; each code -> designed state, 14 §2 template §4)
                    # (success codes are handled in `onSuccess`; rejection codes in `onError` via `mapApiError` — 04 §3)
  - accepted: "toast + reset + list refresh"
  - rejected_duplicate_event: "keep form, field error on title"
form:               # null, or the form fields + client-side rules (zod)
  - title: string, required
  - capacity: number, > 0, coerced from input
clientState:        # null (default) | what genuinely needs URL params/a store and why
  - "status filter + page → URL search params (shareable)"
i18nNamespace:      # usually == feature; list the key groups, e.g. list.*, form.*, errors.*
guard:              # public | authenticated | role:<name>   (05-auth-google.md §5)
seo:                # null for authenticated screens | for public segments: localized title/
                    # description source keys, og/hreflang requirements (07 §5)
isNewFeature:       # true = create the slice skeleton too; false = extend existing slice
```

> Rule of thumb (YAGNI, see `01-architecture-principles.md`): no store unless client state is
> shared across distant components; no optimistic update unless latency hurts; a two-component
> feature keeps flat files (no subfolders); no `server/` folder unless the slice has RSC-only
> logic; no Server Action unless the write touches server-only state (04 §7).

---

## DETERMINISTIC OUTPUT — files the agent MUST produce

Emit exactly the files below, each at its path with a one-line responsibility. Follow the naming
map in `02-folder-structure.md` §5 and the layer patterns in `03-ui-layer.md` / `04-data-layer.md`.
Paths are relative to repo root.

### A. New slice skeleton (only when `isNewFeature: true`)

| Path | Responsibility |
| --- | --- |
| `src/features/<feature>/index.ts` | Public surface: export ONLY what `app/` composes (view, form) |
| `messages/<lng>/<feature>.json` | The namespace, per configured language |
| `messages/<lng>.ts` | + one import line per language registering the namespace |
| `feature_list.json` | add or UPDATE the plop-created `todo` entry to `in-progress` — never a duplicate entry |

### B. The capability (always)

| Path | Responsibility | Ref |
| --- | --- | --- |
| `src/app/[locale]/<group>/<segment>/page.tsx` | THIN server page: `generateMetadata` (localized; `robots noindex` if authenticated), the rendering decision from `rendering:`, prefetch via generated key+fn, `HydrationBoundary`, compose the feature view | 04 §4, 07 |
| `src/app/[locale]/<group>/<segment>/loading.tsx` + `error.tsx` | Streaming fallback (skeleton) + segment boundary using kernel `error-fallback` | 03 §5, 07 §3 |
| `src/features/<feature>/components/<view>.tsx` | Client tree: Suspense hook + kernel primitives; renders loading/empty/error per the three-state rule, plus submitting and one designed state per code in `outcomes` | 03 §5, 04 §5 |
| `src/features/<feature>/components/<form>.tsx` | `"use client"`: RHF + zodResolver + generated mutation; server errors → `form.setError` | 03 §4 |
| `src/features/<feature>/schemas/<form>.schema.ts` | Zod FORM schema; messages are i18n keys | 03 §4 |
| `src/features/<feature>/hooks/use-<x>.ts` | Only if listed in `clientState` (URL params / composed logic) | 01 §4 |
| `src/features/<feature>/<feature>.test.tsx` | RTL + MSW on the client tree: happy path, empty, error, form validation + submit, and each `outcomes` code renders its designed state | 09 |
| `src/test/msw/handlers/<tag>.ts` | Handlers for the operations used, shaped from generated models | 09 §2 |

### C. Wiring (always — an unwired slice does nothing)

| Edit | Content |
| --- | --- |
| Guard | `guard: authenticated` segments live under the protected group (its layout enforces `auth()`); `role:` adds the role check; public segments under `(public)` with the `seo:` metadata filled |
| `openapi.json` + `pnpm generate:api` | ONLY if the spec changed; commit spec + generated output together |
| `revalidateTag` story | If a PUBLIC cached segment shows data this capability mutates: the tag + trigger (action/webhook) per 07 §4 |
| `feature_list.json` | On completion: status + evidence + testedAt (see SELF-CHECK) |
| `e2e/<flow>.spec.ts` | For core flows / public segments: the e2e coverage `09` §5 assigns to the server half |

> Output-scaling (a CEILING, adapt to size): a read-only view needs only the page + view + test +
> handlers. A full CRUD capability needs A + B + C. Do not emit folders, stores, actions, or
> hooks the capability does not use.

---

## RULES (non-negotiable)

- **Dependency rule**: the slice imports kernel + `api/` only. NEVER another feature, NEVER `app/`.
  Cross-feature data sharing happens through the query cache (same generated hook), composition
  happens in `app/`.
- **Boundary rule**: the page stays a Server Component (no `"use client"`); the directive goes on
  interactive leaves; no server-only imports (env, `next/headers`, `auth()`) in client files;
  props crossing the boundary are serializable.
- **Rendering is declared, not inherited**: implement exactly the `rendering:` input — dynamic
  segments rely on the mutator's `no-store`; cached segments pass explicit tags/revalidate
  through the generated function's options; never cache authenticated data in Next's cache.
- **Generated layer is read-only**: missing/wrong endpoint → fix `openapi.json`, regenerate. No
  hand-written fetch calls, no hand-rolled query keys — use generated functions + key functions
  (prefetch and hook MUST share the same generated key).
- **Server state stays in the cache**: no `useEffect`-copying into state; mutations invalidate via
  generated key functions (+ `revalidateTag` per the C-table row when applicable).
- **Errors**: branch on `mapApiError` output (`04-data-layer.md` §3) — every code in `outcomes`
  renders its designed state; faults with `details[]` map to field errors; unexpected faults
  reach the segment's `error.tsx`. No raw status-code switches in components, and never one
  generic message for all rejections.
- **Every user-facing string** through next-intl `t()`; plurals via ICU; schema messages are
  keys; navigation via `@/i18n/navigation` only.
- **Naming is mechanical**: App Router reserved names; otherwise kebab-case, `use-*.ts`,
  `*.schema.ts`, `*.test.tsx` per `02-folder-structure.md` §5.
- **Tests are part of the slice**: MSW at the network level (never `vi.mock` generated modules);
  accessible queries; fresh QueryClient per test (`09-testing-strategy.md`).
- **Harness**: keep `feature_list.json` current; ONE feature in progress; update
  `session-handoff.md` if the session ends mid-capability (`13-harness-engineering.md`).

---

## SELF-CHECK (run before declaring done)

- [ ] Every file in the relevant output table exists at the exact path with the correct pattern.
- [ ] `pnpm check && pnpm lint && pnpm arch` — zero errors (rings, naming, generated-code purity).
- [ ] `pnpm test` — the slice's tests pass; new handlers registered; `onUnhandledRequest: 'error'`
      surfaced no unmocked calls.
- [ ] `pnpm build` — clean, and the route table shows the DECLARED rendering mode for each of the
      slice's segments (07 §1).
- [ ] Route reachable in the running app (`pnpm dev`): guard behavior verified (anonymous
      redirected if `guard: authenticated`), the three states (loading/empty/error) render.
- [ ] Each code in `outcomes` renders its designed state; double-click sends ONE request.
- [ ] Mutation invalidates its list query (create → list refreshes without reload); the
      `revalidateTag` story implemented if a public cached page shows the data.
- [ ] Public segments: localized `<title>` in view-source; authenticated segments: `noindex`.
- [ ] All strings translated in EVERY configured language file (locale key parity holds).
- [ ] No import from another feature, no deep import past any `index.ts`, no edit under
      `src/api/generated/**` (`git status` is clean there or shows regeneration only).
- [ ] `feature_list.json` updated: status `"pass"` WITH evidence (what was run/observed + date);
      `claude-progress.md` appended; `session-handoff.md` updated if handing off.

---

## FILLED MINI-EXAMPLE (input contract)

```yaml
feature: events
capability: list + create event
segments: ["(app)/events"]
rendering: ["(app)/events: dynamic + prefetch/hydrate"]
apiTags: [events]
operations: [listEvents + getListEventsQueryKey, useListEventsSuspense, useCreateEvent]
useCaseSpec: docs/design/events/create-event.md (approved 2026-08-01)
outcomes:
  - accepted: "toast + reset + list refresh"
  - rejected_duplicate_event: "keep form, field error on title"
form:
  - title: string, required
  - capacity: number, > 0, coerced from input
clientState: null
i18nNamespace: events (list.*, form.*, form.errors.*)
guard: authenticated
seo: null
isNewFeature: true
```

Expected emitted slice (A + B + C): `features/events/{index.ts, components/events-view.tsx,
components/event-form.tsx, schemas/event-form.schema.ts, events.test.tsx}`;
`app/[locale]/(app)/events/{page.tsx, loading.tsx, error.tsx}`;
`messages/{en,vi}/events.json` + one import line per `messages/<lng>.ts`;
`test/msw/handlers/events.ts`; a `feature_list.json` entry moved to `"pass"` with evidence.

> See `11-example-output.md` for a fully fleshed reference slice, and
> `12-implementation-checklist.md` for the repo-wide acceptance gate.

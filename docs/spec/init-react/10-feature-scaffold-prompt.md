# 10 — Feature Scaffold Prompt

This is the OPERATIONAL, copy-paste prompt the team feeds an AI coding agent to add a **new
feature slice** (or extend one) in an existing project. It is the repeatable companion to
`00-system-prompt.md`: where 00 stands up the whole repo, this prompt extends it deterministically,
one slice at a time.

Prefer deterministic scaffolding first: run `pnpm plop feature -- --name <name>` to emit the
skeleton, then have the agent fill the bodies per the patterns below. Use this prompt to drive
that fill — or to scaffold by hand when no generator exists yet.

---

## ROLE

> You are a React + TypeScript engineer working in a feature-sliced SPA (Vite 8, Tailwind v4 +
> shadcn/ui, Orval-generated TanStack Query v5 data layer, react-i18next, four rings with inward
> dependencies). You add exactly ONE feature slice — or one capability inside an existing slice —
> wired into the router. You follow the existing conventions; you do not redesign the architecture.
> Read `AGENTS.md` / `CLAUDE.md` at the repo root first, plus `session-handoff.md` and
> `feature_list.json`; then `01-architecture-principles.md` and `02-folder-structure.md`.

---

## INPUT CONTRACT (fill every field, then paste below the prompt)

```yaml
feature:            # feature name, kebab-case, e.g. invoices
capability:         # what this task adds, e.g. "list + create invoice"
routes:             # route paths this feature owns, e.g. /invoices, /invoices/new
apiTags:            # OpenAPI tags whose generated hooks the slice consumes, e.g. [invoices]
operations:         # generated hooks to use (from src/api/generated/<tag>/)
  - useListInvoicesSuspense     # route primary data → Suspense variant
  - useCreateInvoice            # form mutation
specChange:         # none | "openapi.json updated — run pnpm generate:api first"
form:               # null, or the form fields + client-side rules (zod)
  - customerId: string, required
  - amount: number, > 0, coerced from input
clientState:        # null (default) | what genuinely needs a store/URL params and why
  - "status filter + page → URL search params (shareable)"
i18nNamespace:      # usually == feature; list the key groups, e.g. list.*, form.*, errors.*
guard:              # public | authenticated | role:<name>   (05-auth-google.md)
isNewFeature:       # true = create the slice skeleton too; false = extend existing slice
```

> Rule of thumb (YAGNI, see `01-architecture-principles.md`): no store unless client state is
> shared across distant components; no optimistic update unless latency hurts; a two-component
> feature keeps flat files (no subfolders).

---

## DETERMINISTIC OUTPUT — files the agent MUST produce

Emit exactly the files below, each at its path with a one-line responsibility. Follow the naming
map in `02-folder-structure.md` §5 and the layer patterns in `03-ui-layer.md` / `04-data-layer.md`.
Paths are relative to repo root.

### A. New slice skeleton (only when `isNewFeature: true`)

| Path | Responsibility |
| --- | --- |
| `src/features/<feature>/index.ts` | Public surface: export ONLY what `app/` composes (route component, guard needs) |
| `public/locales/<lng>/<feature>.json` | The namespace, per configured language |
| `src/types/i18next.d.ts` | + one `resources` line registering the namespace |
| `feature_list.json` | + entry `{ id, name, description, status: "in-progress" }` |

### B. The capability (always)

| Path | Responsibility | Ref |
| --- | --- | --- |
| `src/features/<feature>/components/<view>.tsx` | Data view: Suspense hook + kernel primitives; renders loading/empty/error per the three-state rule | 03 §5, 04 §5 |
| `src/features/<feature>/components/<form>.tsx` | RHF + zodResolver + generated mutation; server errors → `form.setError` | 03 §4 |
| `src/features/<feature>/schemas/<form>.schema.ts` | Zod FORM schema; messages are i18n keys | 03 §4 |
| `src/features/<feature>/hooks/use-<x>.ts` | Only if listed in `clientState` (URL params / composed logic) | 01 §4 |
| `src/features/<feature>/<feature>.test.tsx` | RTL + MSW: happy path, empty, error, form validation + submit | 09 |
| `src/test/msw/handlers/<tag>.ts` | Handlers for the operations used, shaped from generated models | 09 §2 |

### C. Wiring (always — an unwired slice does nothing)

| Edit | Content |
| --- | --- |
| `src/app/router.tsx` | Lazy route(s): `const InvoicesRoute = lazy(() => import('@/features/invoices'))`; wrap per `guard` (`<RequireAuth>`) with route-level `<Suspense>` + error boundary |
| `openapi.json` + `pnpm generate:api` | ONLY if `specChange` says so; commit spec + generated output together |
| `feature_list.json` | On completion: status + evidence + testedAt (see SELF-CHECK) |

> Output-scaling (a CEILING, adapt to size): a read-only view needs only B's view + test +
> handlers. A full CRUD capability needs A + B + C. Do not emit folders, stores, or hooks the
> capability does not use.

---

## RULES (non-negotiable)

- **Dependency rule**: the slice imports kernel + `api/` only. NEVER another feature, NEVER `app/`.
  Cross-feature data sharing happens through the query cache (same generated hook), composition
  happens in `app/`.
- **Generated layer is read-only**: missing/wrong endpoint → fix `openapi.json`, regenerate. No
  hand-written axios calls, no hand-rolled query keys — use generated hooks + key functions.
- **Server state stays in the cache**: no `useEffect`-copying into state; mutations invalidate via
  generated key functions.
- **Errors**: expected failures render (form/field errors, toasts); unexpected throw to the route
  error boundary. No status-code switches in components (`04-data-layer.md` §3).
- **Every user-facing string** through `t('<feature>:<key>')`; plurals via `_one/_other`; schema
  messages are keys.
- **Naming is mechanical**: kebab-case files, `use-*.ts`, `*.schema.ts`, `*.store.ts`, `*.test.tsx`
  per `02-folder-structure.md` §5.
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
- [ ] Route reachable in the running app (`pnpm dev`): guard behavior verified (anonymous
      redirected if `guard: authenticated`), the three states (loading/empty/error) render.
- [ ] Mutation invalidates its list query (create → list refreshes without reload).
- [ ] All strings translated in EVERY configured language file (locale key parity holds).
- [ ] No import from another feature, no deep import past any `index.ts`, no edit under
      `src/api/generated/**` (`git status` is clean there or shows regeneration only).
- [ ] `feature_list.json` updated: status `"pass"` WITH evidence (what was run/observed + date);
      `claude-progress.md` appended; `session-handoff.md` updated if handing off.

---

## FILLED MINI-EXAMPLE (input contract)

```yaml
feature: invoices
capability: list + create invoice
routes: [/invoices]
apiTags: [invoices]
operations: [useListInvoicesSuspense, useCreateInvoice]
specChange: none
form:
  - customerId: string, required
  - amount: number, > 0, coerced from input
clientState: null
i18nNamespace: invoices (list.*, form.*, form.errors.*)
guard: authenticated
isNewFeature: true
```

Expected emitted slice (A + B + C): `features/invoices/{index.ts, components/invoice-list.tsx,
components/invoice-form.tsx, schemas/invoice-form.schema.ts, invoices.test.tsx}`;
`public/locales/{en,vi}/invoices.json`; a `resources` line in `types/i18next.d.ts`;
`test/msw/handlers/invoices.ts`; a lazy `/invoices` route wrapped in `<RequireAuth>` in
`app/router.tsx`; a `feature_list.json` entry moved to `"pass"` with evidence.

> See `11-example-output.md` for a fully fleshed reference slice, and
> `12-implementation-checklist.md` for the repo-wide acceptance gate.

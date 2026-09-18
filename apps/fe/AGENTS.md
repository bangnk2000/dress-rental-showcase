# AGENTS.md — apps/fe (architecture contract)

React 19 SPA per the init-react set — entry point `docs/spec/init-react/README.md` (open its
numbered detail files only per the File Map, never the whole folder) + the monorepo deltas in
`docs/spec/init-monorepo-contract/01-workspace-structure.md` §4. **Session harness lives at
the repo ROOT** (`../../AGENTS.md`, `feature_list.json`, `init.sh`) — never create harness
files here.

## Commands (run from repo root)

| Command | What |
| --- | --- |
| `pnpm --filter fe dev` | Vite dev server on :5173 (`/api` proxied to BE :3000) |
| `pnpm --filter fe build` / `preview` | tsc + production build / serve `dist` (PWA checks need this) |
| `pnpm --filter fe check` / `lint` / `arch` / `test` | gates (tsc, eslint boundaries, `scripts/check-architecture.sh`, vitest) |
| `pnpm --filter fe e2e` | Playwright happy path; starts BE + the built FE itself, needs a migrated + seeded DB (deviation 5) |
| `pnpm --filter fe generate:api` | Orval: `packages/contract/openapi.json` → `src/api/generated/` |
| `pnpm --filter fe plop feature -- --name <kebab>` | deterministic feature-slice scaffold |
| `pnpm contract` (root) | after ANY BE API change: re-emit spec + regenerate this client |

## Ring rules (eslint-plugin-boundaries v7 + `pnpm --filter fe arch` enforce)

- `app/` → `features/<name>/` → kernel (`components|lib|hooks|stores|types`) + `api/`.
- A feature never imports another feature; import features only via `@/features/<name>` (index).
- Nothing imports `@/app/`; kernel imports only kernel; axios/fetch only inside `src/api/`.
- Server state lives ONLY in the TanStack Query cache (generated hooks); never copied to state.
- File naming (kebab-case, `use-*.ts`, `*-route.tsx`, `*.schema.ts`, …): map in `docs/spec/init-react/02-folder-structure.md`.

## Contract rules (the monorepo's reason to exist)

- `src/api/generated/**` is READ-ONLY — regenerate via `pnpm contract`, never edit. Same for
  `packages/contract/openapi.json`. "FE needs a field" = BE change first.
- `src/api/mutator/custom-instance.ts` is the ONE HTTP door: auth header, 401 refresh-and-retry,
  base URL. `src/api/errors.ts` is the ONE seam that reads wire shapes: `mapApiError` returns
  either an **outcome** (`{ kind: 'outcome', status, ...payload }`) or a **fault**
  (`{ kind: 'fault', code, message, details? }`). Components branch on that — never on
  `error.response.status`, and never with a feature-local status helper.
- Every outcome code has a DESIGNED state, listed in
  [ADR 0001](../../docs/adr/0001-outcome-model-at-the-http-boundary.md) §4 with its i18n key:
  `rejected_*` keeps the form/dialog and says what to do next; a stale-state rejection also
  invalidates the affected queries (the board and list are shared across devices). Faults: query →
  route error boundary via `isServerOrNetworkError`; mutation → local toast + retry, never thrown to
  the boundary. Adding an outcome to the BE means adding its row to ADR 0001 §4 and its key to
  vi + en in the same commit.

## Deviations from the stack spec (deliberate, keep consistent)

1. **Credential bearer+refresh auth, NO Google sign-in** — matches what apps/be shipped. Tokens
   live in `src/api/mutator/auth-tokens.ts`: access token in module memory, refresh token in
   localStorage key `dress-rental.refresh-token` (recorded trade-off: persistence over strict XSS
   hygiene for a staff tablet app). `/api/v1/auth/login|refresh` are exempt from the 401→retry
   interceptor (their 401s are terminal).
2. **vi is the i18n key schema (vi-first)**, en mirrors it — `src/types/i18next.d.ts` imports the
   vi JSON; `pnpm arch` enforces vi↔en key parity.
3. **`/dresses/:id` is live** (`rentals/availability-check`): dress info from get-dress,
   calendar from booked-ranges, checker from availability — detail data comes from those
   endpoints only, never fetch-list-and-find.
4. **No shell routes remain.** `/rentals` is the real list (`rentals/list-rentals`,
   URL-owned q/status/page via `use-rental-filters`); `/rentals/new` navigates to it on
   success. `/rentals/:id` is the rental detail (`rentals/update-rental`, FR-RENT-12: get-rental
   + the shared money dialog) and `/rentals/:id/edit` the OWNER's edit form (FR-RENT-13) — both
   `/rentals/new` and the edit render ONE `components/rental-form.tsx`; the route owns the
   mutation, the form owns the dress rejections. The today board at `/` is live and ACTIONABLE (`rentals/today-board` +
   `rentals/return-rental`): three sections (due-out / due-back / overdue), pickup +
   return-and-settle mutations, and it ALWAYS sends the device-local date
   (`features/today/lib/local-date.ts`) — never rely on the server's "today". jsdom cannot
   open the Radix Select popover — drive status filters via the URL in tests.
5. **Playwright e2e lives in `e2e/`** (`infra/e2e-playwright`, automated by `infra/e2e-ci`):
   `pnpm --filter fe e2e` runs the vi-locale happy path against the REAL stack and **starts that
   stack itself** — BE on :3000 (`pnpm --filter be build && start`, so Nest resolves `apps/be/.env`)
   and the FE **production build** served by `vite preview` on :4173, whose `/api` proxy mirrors the
   dev server (`vite.config.ts`). Prerequisites are only a migrated + seeded database and installed
   browsers (`pnpm --filter fe exec playwright install chromium`) — tests never provision the DB.
   Set `E2E_BASE_URL` to say "I run the servers myself": `webServer` is then skipped entirely and
   the run just points at your stack. Root gates and init.sh still EXCLUDE e2e (needs browsers +
   a live DB) — **CI runs it as its own `e2e` job** and uploads report + trace on failure;
   vitest excludes `e2e/` via its include glob. Locators are scoped to the run's OWN rows
   (`ownRows`) — the target database is not assumed empty, so never reach for a page-wide
   `getByRole('button', …)` on the board.
6. **`customInstance` omits the legacy `promise.cancel` hack** — TanStack Query v5 passes
   AbortSignal in the request config (signal-based cancellation).
7. **Unified `radix-ui` package** (not per-primitive `@radix-ui/react-*`); shadcn `sonner.tsx` is
   hand-authored for Vite (no next-themes).
8. **No `Idempotency-Key`** (04-data-layer §3): no client sends it, no endpoint honours it. A
   double-submitted rental is stopped by the DB overlap constraint — which is exactly why that
   constraint has proof tests (`pnpm --filter be test:e2e`). It needs a BE store first, so closing
   it is an ADR, not a FE tweak.

## Screen rules learned the hard way (2026-08-10 UI review)

- **No `window.confirm`.** An irreversible action uses `components/feedback/confirm-dialog.tsx`:
  its buttons stay in the app's language, it does not block the thread, and it does not render as
  browser chrome inside the installed PWA. Its dismiss button is `Quay lại`, never `Hủy` — on the
  rentals list the confirmed action is itself a cancel.
- **A number the user did not type gets its arithmetic shown**, not just its result: the return
  dialog states deposit, fees and the resulting refund (`rentals/settlement-clarity`), and every
  amount field reads its digits back grouped through `FormDescription`.
- **An outcome payload is a UI affordance.** `dressIds` exists so the form can point at the exact
  rows; a rejection that only sets a form-level message throws that away.
- **Actions on the today board are thumb targets** (`h-11`, not `sm`) and carry the customer in
  their accessible name, since the visible label repeats down the list.
- **One mutation object serves every row**: gate the spinner on `mutation.variables`, not on
  `isPending`, or the whole list looks busy and none of it looks specific.
- **A mutation that moves MONEY invalidates the rental's ledger too**, not only the board and list
  parameterless keys: `getListPaymentsHttpControllerListQueryKey(rentalId)`. Two screens read that
  query now (the money dialog on `/rentals`, the return dialog's refund basis), so a settlement that
  skips it leaves the reconciliation screen showing a pre-settlement ledger for the whole 60s
  `staleTime`. Playwright caught this; no unit test would have.
- **A reference figure must say it is one.** The refund is computed from the deposit ACTUALLY
  collected (`summary.deposit`); the catalog standard is a fallback and the banner then reads
  "Chưa ghi nhận tiền cọc" rather than quietly presenting it as money the shop holds.

Two things that are NOT deviations but bite if missed: the three former
`features/*/lib/is-conflict-error.ts` files are deleted — never recreate that shape; and rejection
copy is per feature namespace, where `t('status.<value>')` renders the `currentStatus` payload, so a
NEW rental status needs its label in BOTH `rentals` and `today`.

## Where do I add a new feature?

1. `pnpm --filter fe plop feature -- --name <kebab>` → slice + vi/en locales + i18next.d.ts
   namespace registration (plop does the d.ts edit).
2. Wire the route in `src/app/router.tsx` (lazy import of the feature index — deliberate edit).
3. If the API grew: BE slice first, then `pnpm contract` (root), commit spec + client together.
4. Add/claim the entry in root `feature_list.json`; done = check/lint/arch/test green + runtime
   proof (see root harness).

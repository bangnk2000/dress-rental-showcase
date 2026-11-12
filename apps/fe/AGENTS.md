# AGENTS.md — apps/fe (architecture contract)

React 19 SPA per the init-react set — entry point `docs/spec/init-react/README.md` (numbered files
only per its File Map) + monorepo deltas `docs/spec/init-monorepo-contract/01-workspace-structure.md`
§4. The session harness is at the repo ROOT — never create harness files here.

## Commands (run from repo root)

| Command | What |
| --- | --- |
| `pnpm --filter fe dev` | Vite dev server on :5173 (`/api` proxied to BE :3000) |
| `pnpm --filter fe build` / `preview` | tsc + production build / serve `dist` (PWA checks need this) |
| `pnpm --filter fe check` / `lint` / `arch` / `test` | gates (tsc, eslint boundaries, `scripts/check-architecture.sh`, vitest) |
| `pnpm --filter fe e2e` | Playwright; starts BE + the built FE itself, needs a migrated + seeded DB (#5) |
| `pnpm --filter fe generate:api` | Orval: `packages/contract/openapi.json` → `src/api/generated/` |
| `pnpm --filter fe plop feature -- --name <kebab>` | deterministic feature-slice scaffold |
| `pnpm contract` (root) | after ANY BE API change: re-emit spec + regenerate this client |

## Ring rules (eslint-plugin-boundaries v7 + `pnpm --filter fe arch` enforce)

- `app/` → `features/<name>/` → kernel (`components|lib|hooks|stores|types`) + `api/`.
- A feature never imports another feature; import features only via `@/features/<name>` (index).
- Nothing imports `@/app/`; kernel imports only kernel; axios/fetch only inside `src/api/`.
- Server state lives ONLY in the TanStack Query cache (generated hooks); never copied to state.
- File naming (kebab-case, `use-*.ts`, `*-route.tsx`, `*.schema.ts`, …): map in `docs/spec/init-react/02-folder-structure.md`.
- **One UI shared by several features** (e.g. the cancel dialog on board, `/rentals`, `/rentals/:id`):
  the presentational part lives in the kernel (`components/rentals/cancel-rental-dialog.tsx`, which
  also owns its plain-data result types); its data side — queries, mutation, invalidations,
  outcome → result mapping — is a hook in the api ring (`src/api/use-cancel-rental.ts`; api → kernel
  is allowed, kernel → `@/api` is not). Each feature calls the hook and passes it to the dialog.

## Contract rules (the monorepo's reason to exist)

- `src/api/generated/**` is READ-ONLY — regenerate via `pnpm contract`, never edit. Same for
  `packages/contract/openapi.json`. "FE needs a field" = BE change first.
- `src/api/mutator/custom-instance.ts` is the ONE HTTP door: auth header, 401 refresh-and-retry,
  base URL. `src/api/errors.ts` is the ONE seam that reads wire shapes: `mapApiError` returns
  either an **outcome** (`{ kind: 'outcome', status, ...payload }`) or a **fault**
  (`{ kind: 'fault', code, message, details? }`). Components branch on that — never on
  `error.response.status`, and never with a feature-local status helper (the deleted
  `features/*/lib/is-conflict-error.ts` shape is never recreated). Never name an outcome payload
  field `kind`: `mapApiError` overwrites it.
- Every outcome code has a DESIGNED state, listed in
  [ADR 0001](../../docs/adr/0001-outcome-model-at-the-http-boundary.md) §4 with its i18n key:
  `rejected_*` keeps the form/dialog and says what to do next; a stale-state rejection also
  invalidates the affected queries (the board and list are shared across devices). Faults: query →
  route error boundary via `isServerOrNetworkError`; mutation → local toast + retry, never thrown to
  the boundary. Adding an outcome to the BE means adding its row to ADR 0001 §4 and its key to
  vi + en in the same commit. Rejection copy is per feature namespace; `t('status.<value>')` renders
  the `currentStatus` payload, so a NEW rental status needs its label in `rentals`, `today` AND
  `common:cancelRental.status`.
- **Photos go straight to R2, on Save only** (`docs/design/catalog/dress-photo-upload.md` §9): the
  field `components/media/photo-list-field.tsx` only edits a list of `PhotoItem`s (stored URL |
  chosen file, `photo-items.ts`) and uploads nothing. The dress form's Save runs `uploadLocalPhotos`
  with the batch uploader from `src/api/use-photo-uploader.ts` — ONE signing request through the
  generated client, then one XHR PUT per file with exactly the returned headers and NO bearer token
  (arch a3: XHR only in `src/api/`) — and saves the dress only when every photo uploaded. Photo
  display goes through `@/lib/photo-url` → `@dress-rental/image-url`, the one reader of
  `VITE_IMAGE_BASE_URL` (arch g1/g2).

## Deviations from the stack spec (deliberate, keep consistent)

1. **Credential bearer+refresh auth, NO Google sign-in** — matches apps/be. Tokens live in
   `src/api/mutator/auth-tokens.ts`: access token in module memory, refresh token in localStorage
   key `dress-rental.refresh-token` (recorded trade-off: persistence over strict XSS hygiene for a
   staff tablet app). `/api/v1/auth/login|refresh` are exempt from the 401→retry interceptor
   (their 401s are terminal).
2. **vi is the i18n key schema (vi-first)**, en mirrors it — `src/types/i18next.d.ts` imports the
   vi JSON; `pnpm arch` enforces vi↔en key parity.
3. **`/dresses/:id`** (`rentals/availability-check`): dress info from get-dress, calendar from
   booked-ranges, checker from availability — detail data comes from those endpoints only, never
   fetch-list-and-find.
4. **Rentals screens, no shell routes.** `/` today board (due-out / due-back / overdue, pickup +
   return-and-settle) — it ALWAYS sends the device-local date (`features/today/lib/local-date.ts`),
   never relies on the server's "today"; day-stepping runs in a transition; a rental handed out
   during the day stays on the hand-out list, marked done. `/rentals` list (URL-owned
   q/status/page via `use-rental-filters`; jsdom cannot open the Radix Select popover — drive status
   filters via the URL in tests). `/rentals/:id` detail (FR-RENT-12, shared money dialog),
   `/rentals/:id/edit` (FR-RENT-13, any staff since 2026-11-07, no role gate). `/rentals/new` and
   the edit render ONE `components/rental-form.tsx`; the route owns the mutation, the form owns the
   dress rejections. **Every rentals mutation invalidates the board AND list parameterless keys**
   (staleTime 60s), plus the rental's detail key when it touches one rental, plus its payments key
   when it moves money (§Screen rules).
5. **Playwright e2e in `e2e/`** — real stack, started by the command itself; root gates and
   `init.sh` EXCLUDE it, **CI runs it as its own `e2e` job**. Locators are scoped to the run's OWN
   rows (`ownRows`). Projects `chromium` + `phone` (NFR-06 proof), env, prerequisites:
   [`e2e/README.md`](e2e/README.md).
6. **`customInstance` omits the legacy `promise.cancel` hack** — TanStack Query v5 passes
   AbortSignal in the request config (signal-based cancellation).
7. **Unified `radix-ui` package** (not per-primitive `@radix-ui/react-*`); shadcn `sonner.tsx` is
   hand-authored for Vite (no next-themes).
8. **No `Idempotency-Key`** (04-data-layer §3): no client sends it, no endpoint honours it. A
   double-submitted rental is stopped by the DB overlap constraint — which is why that constraint
   has proof tests (`pnpm --filter be test:e2e`). Closing it needs a BE store first: an ADR, not a FE tweak.

## Screen rules learned the hard way (2026-08-10 UI review)

- **No `window.confirm`.** An irreversible action uses `components/feedback/confirm-dialog.tsx`
  (app language, non-blocking, no browser chrome in the installed PWA). Its dismiss button is
  `Quay lại`, never `Hủy` — on the rentals list the confirmed action is itself a cancel.
- **A number the user did not type gets its arithmetic shown**, not just its result: the return
  dialog states deposit, fees and the resulting refund (`rentals/settlement-clarity`); every amount
  field reads its digits back grouped through `FormDescription`.
- **An outcome payload is a UI affordance.** `dressIds` exists so the form can point at the exact
  rows; a rejection that only sets a form-level message throws that away.
- **Today-board actions are thumb targets** (`h-11`, not `sm`) and carry the customer in their
  accessible name, since the visible label repeats down the list.
- **One mutation object serves every row**: gate the spinner on `mutation.variables`, not on
  `isPending`.
- **A mutation that moves MONEY also invalidates the rental's ledger**:
  `getListPaymentsHttpControllerListQueryKey(rentalId)` — the money dialog and the return dialog's
  refund basis read it; skipping it shows a pre-settlement ledger for the 60s `staleTime`.
- **A mutation that renders its own rejections passes `onError: () => undefined`** — the app-wide
  `QueryClient` (`app/providers.tsx`) toasts "Thao tác thất bại" on EVERY mutation error. Tests
  cannot catch a double toast: the test `QueryClient` (`src/test/render.tsx`) has no global `onError`.
- **A reference figure must say it is one.** The refund is computed from the deposit ACTUALLY
  collected (`summary.deposit`); the catalog standard is a fallback, and the banner then reads
  "Chưa ghi nhận tiền cọc" instead of presenting it as money the shop holds.
- **Every screen works on a phone (NFR-06, [cms-mobile-ux](../../docs/design/cms-mobile-ux.md))
  with ONE DOM.** Never render a table plus `md:hidden` cards, a second nav, or duplicated
  buttons/text: jsdom applies no CSS (both copies are "visible" to Testing Library) and Playwright
  `toHaveCount` counts hidden nodes. A data table opts into `<Table stacked>` (rows become blocks
  below `md`; `TableCell` `label` / `stack="title|full|actions"`; hide a secondary column with
  `max-md:hidden`). Touch sizes come from the kernel (`pointer-coarse:` in button/select/input) —
  don't hand-size buttons. Dialogs scroll inside a `100dvh` cap; never add a local `max-h-[90vh]`.
  A reason shown only in `title` never reaches a touch screen — render it as visible text.

## Where do I add a new feature?

1. `pnpm --filter fe plop feature -- --name <kebab>` → slice + vi/en locales + i18next.d.ts
   namespace registration (plop does the d.ts edit).
2. Wire the route in `src/app/router.tsx` (lazy import of the feature index — deliberate edit).
3. If the API grew: BE slice first, then `pnpm contract` (root), commit spec + client together.
4. Add/claim the entry in root `feature_list.json`; done = check/lint/arch/test green + runtime
   proof (see root harness).

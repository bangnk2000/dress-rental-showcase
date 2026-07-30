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
  base URL. Components never inspect `error.response.status` (use `src/api/errors.ts` helpers).

## Deviations from the stack spec (deliberate, keep consistent)

1. **Credential bearer+refresh auth, NO Google sign-in** — matches what apps/be shipped. Tokens
   live in `src/api/mutator/auth-tokens.ts`: access token in module memory, refresh token in
   localStorage key `dress-rental.refresh-token` (recorded trade-off: persistence over strict XSS
   hygiene for a staff tablet app). `/api/v1/auth/login|refresh` are exempt from the 401→retry
   interceptor (their 401s are terminal).
2. **vi is the i18n key schema (vi-first)**, en mirrors it — `src/types/i18next.d.ts` imports the
   vi JSON; `pnpm arch` enforces vi↔en key parity.
3. **`/dresses/:id` is a shell** until a get-dress/availability endpoint exists — never
   fetch-list-and-find.
4. **rentals/ and today/ routes are shells** awaiting their BE slices (`rentals/*` entries in
   `feature_list.json`).
5. **Playwright/e2e deferred** until the first cross-contract feature; root gates exclude fe e2e.
6. **`customInstance` omits the legacy `promise.cancel` hack** — TanStack Query v5 passes
   AbortSignal in the request config (signal-based cancellation).
7. **Unified `radix-ui` package** (not per-primitive `@radix-ui/react-*`); shadcn `sonner.tsx` is
   hand-authored for Vite (no next-themes).

## Where do I add a new feature?

1. `pnpm --filter fe plop feature -- --name <kebab>` → slice + vi/en locales + i18next.d.ts
   namespace registration (plop does the d.ts edit).
2. Wire the route in `src/app/router.tsx` (lazy import of the feature index — deliberate edit).
3. If the API grew: BE slice first, then `pnpm contract` (root), commit spec + client together.
4. Add/claim the entry in root `feature_list.json`; done = check/lint/arch/test green + runtime
   proof (see root harness).

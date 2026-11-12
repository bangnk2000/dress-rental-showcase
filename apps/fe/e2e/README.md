# apps/fe/e2e — Playwright (FE Deviation #5)

Read this only when running or writing a Playwright spec. The rules that bind every session are in
`../AGENTS.md` #5.

## What runs and where

- `pnpm --filter fe e2e` runs the vi-locale specs against the REAL stack and **starts that stack
  itself** (`infra/e2e-playwright`, automated by `infra/e2e-ci`): BE on :3000
  (`pnpm --filter be build && start`, so Nest resolves `apps/be/.env`) and the FE **production
  build** served by `vite preview` on :4173, whose `/api` proxy mirrors the dev server
  (`vite.config.ts`).
- Prerequisites are only a migrated + seeded database and installed browsers
  (`pnpm --filter fe exec playwright install chromium`) — tests never provision the DB.
- Set `E2E_BASE_URL` to say "I run the servers myself": `webServer` is then skipped entirely and
  the run just points at your stack.
- Root gates and `init.sh` EXCLUDE e2e (needs browsers + a live DB). **CI runs it as its own `e2e`
  job** and uploads report + trace on failure. Vitest excludes `e2e/` via its include glob.

## Projects (`playwright.config.ts`, since 2026-11-12 `fe:mobile-ux`)

- `chromium` — every spec except `phone-layout.spec.ts` (the happy path and the desktop specs).
- `phone` (Pixel 7, Chromium) — only `phone-layout.spec.ts`, the NFR-06 proof: no page overflow,
  no off-edge element, no sideways-scrolling stacked table, tall dialogs fit, nav reachable,
  ≥ 44px targets on coarse pointers. It makes its own fixtures.

## Writing a spec

- Locators are scoped to the run's OWN rows (`ownRows`) — the target database is not assumed
  empty, so never reach for a page-wide `getByRole('button', …)` on the board.
- `toHaveCount` counts hidden nodes too — one more reason the app renders ONE DOM per screen
  (`../AGENTS.md` §Screen rules).

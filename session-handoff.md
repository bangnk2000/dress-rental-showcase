# Session Handoff

## 2026-07-30 (3) — FE bootstrap (`infra/fe-bootstrap` = pass)

- Done: `apps/fe` complete per init-react + monorepo deltas — foundation (Vite 8/React 19/
  Tailwind v4/PWA/i18n vi-first), auth slice (bearer+refresh via the one mutator, guards,
  SignOutButton wired into the root layout), dresses slice (list/search/status filter/
  pagination/create dialog against generated Orval hooks), rentals/today/dress-detail shells;
  guardrails shipped: `scripts/check-architecture.sh` (11 checks, wired as `pnpm --filter fe
  arch`), `plopfile.cjs` feature generator (slice + vi/en locales + i18next.d.ts registration),
  eslint-plugin-boundaries migrated v6→v7 `policies` syntax (probes re-verified, 0 warnings),
  `apps/fe/AGENTS.md` architecture contract (deviations recorded). All root gates green +
  runtime proof through the Vite proxy (login 200 / list 200 / no-token 401 / create 201 /
  dup 409) — evidence in `feature_list.json`.
- Next: EITHER `rentals/create-rental` per README step 5 rhythm (BE slice → `pnpm contract` →
  FE slice, one entry) OR finish `catalog/list-dresses` (CSV seed import — the only remaining
  in-progress item).
- Watch out:
  - pnpm 11 PATH gotcha in WSL: `/home/bangnk/.local/share/pnpm` must come FIRST in PATH
    (an older pnpm shadows it otherwise).
  - Auth deviations (refresh token in localStorage key `dress-rental.refresh-token`, login/
    refresh exempt from 401→retry) are documented in `apps/fe/AGENTS.md` — read before touching
    the mutator.
  - `/dresses/:id` is a shell — do NOT fetch-list-and-find; wait for a get-dress/availability
    endpoint (rentals/availability-check).
  - `workbox-window` is a real devDependency — the PWA update prompt imports it; do not prune.
  - boundaries config is v7 `policies` syntax now (`boundaries/dependencies` rule) — keep new
    syntax; captured-value template is `{{ from.element.captured.featureName }}`.


- Done: `apps/be` scaffolded per init-nestjs-hexagonal + monorepo deltas. 4 contexts wired:
  `identity` (login/refresh/me, JWT bearer + ABAC policy registry, fail-closed), `catalog`
  (create-dress + list-dresses, proving slice), `rentals`/`payments` (DB schema only —
  migrations 0002 with the EXCLUDE overlap constraint, domain code NOT written yet).
  All gates green; contract emitted offline; smoke test + psql overlap proof recorded in
  `feature_list.json`.
- Next: EITHER `infra/fe-bootstrap` (README step 4 — contract is ready for Orval) OR finish
  `catalog/list-dresses` (CSV seed import). FE bootstrap unblocks end-to-end earlier.
- Watch out:
  - Deviations are deliberate and documented in `apps/be/AGENTS.md` (relative imports — no
    path aliases; concrete list DTOs; `*.service.ts` handler naming).
  - `openapi:emit` boots with `OPENAPI_EMIT=1` (DB pool stubbed). If it ever fails with
    "offline-boot violation", an eagerly-connecting provider snuck in — fix the provider.
  - Auth model for FE: bearer + refresh (`/api/v1/auth/login`, `/api/v1/auth/refresh`).
  - Seeded owner: owner@example.com / changeme (dev only — rotate before any real deploy).
  - Dev DB via `docker compose up -d` at root; `.env` in apps/be is gitignored dev config.

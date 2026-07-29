# Session Handoff

## 2026-07-30 (2) — BE bootstrap (`infra/be-bootstrap` = pass)

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

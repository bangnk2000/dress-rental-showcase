# Release Plan — 2026-08-10-r1 (2026-08-10)

Features: all 20 entries in [`feature_list.json`](../../../feature_list.json) — every one at `pass`.
Per-feature readiness: `readiness-<feature-id>.md` in this folder ([index](./README.md)).

This is the **first deployment**: nothing of this product runs in production, so the release is the
whole thing — the API, the database schema, the staff SPA and the QR Admin SPA. Target environment
(owner decision, 2026-08-10): **one VPS running PM2 + Nginx + PostgreSQL**.

Produced by the `docs/spec/init-release/` lane. It plans and verifies; it deploys nothing.

## 0. Release-wide readiness

These four rows are identical for every feature, so each `readiness-*.md` points here instead of
repeating them.

| Check | Status | Evidence |
| --- | --- | --- |
| Contract evidence: provider + consumer tests | ok (type-level only) | No provider/consumer contract tests exist. Accepted substitute per [init-release 01 §1](../../spec/init-release/01-readiness-and-rollout.md): `pnpm contract:check` — `openapi:emit` → `git diff packages/contract` → `generate:api` → `git diff` both generated clients — plus the generated-freshness item in `pnpm arch` and the CI `contract` job. Re-verified green 2026-08-10 on the release SHA. |
| Observability for new behavior | **missing** | No dashboard, no alert, no error tracker, no uptime check anywhere in the repo or the plan. The only runtime signal is pino JSON on stdout, which after deploy means `pm2 logs` on one box. Nothing watches outcome-code rates or error rates; the step-9 watch list is a human reading logs. |
| Feature flag | **missing** | The codebase has no flag mechanism at all — this is a full-on release. Recorded as risk R2. |
| Owner + on-call | ok | bangnk — both roles. Recorded as risk R3 (single point of failure). Business go/no-go on the shop's behalf is also bangnk's call for r1. |

### Release-wide unchecked items — they block EVERY feature until owned

Per the lane's hard rules, an unchecked item needs a named owner and an **explicit** accepted-risk
note before the release proceeds. The exposure is stated here; accepting it is bangnk's act, not
this document's.

| # | Item | Owner | Accepted-risk note (bangnk fills — until when, and why that is tolerable) |
| --- | --- | --- | --- |
| R1 | No observability: nothing measures error rates or outcome-code rates | bangnk | _open_ — exposure: a regression is discovered by a staff member at the counter, not by a signal. Mean time to notice is one working day |
| R2 | No feature flag: the whole product goes on at once, and the only "off" is the Nginx maintenance page | bangnk | _open_ — exposure: no partial rollout, no cohort, no cheap reversal (see [rollback.md](./rollback.md) step 1) |
| R3 | One person is owner, deployer AND on-call | bangnk | _open_ — exposure: while bangnk is unreachable the shop has no path back to a working app |
| R4 | No provider/consumer contract test; type-level drift gates stand in | bangnk | _open_ — exposure: from r2 on, a breaking contract change is caught by CI only *within* a SHA, never across the rollout window |

## 1. Prerequisites that do not exist in the repo — these block step 1

The repo contains **no deployment artifact**: `git ls-files` matches no `ecosystem.config.*`, no
Nginx conf, no deploy script, no Dockerfile for `be`/`fe`, no systemd unit. The only compose file is
the local dev Postgres. So every command below that names one is `missing`, not "assumed fine".

| # | Prerequisite | Why the release cannot proceed without it | Owner | Status |
| --- | --- | --- | --- | --- |
| P1 | PM2 process definition for the API (`node dist/main.js`, cwd `apps/be`, env from a production `.env`) | Step 6 has no command without it; `enableShutdownHooks()` is in `main.ts`, so a reload path exists — nothing declares it | bangnk | missing |
| P2 | Nginx vhost: serve `apps/fe/dist` at `/` with `try_files $uri /index.html`, proxy `/api` → `127.0.0.1:3000` | NFR-03 is load-bearing, not decorative: `configureApp()` never calls `enableCors()`, so a cross-origin FE receives no CORS headers and **every** call fails. The SPA also uses history routes, so a deep link 404s without the fallback | bangnk | missing |
| P3 | A hostname decision + vhost for the SECOND SPA, `apps/qr-admin/dist` | It is an independent app with its own generated client and **no `base` in its `vite.config.ts`**, so a subpath deploy breaks its asset URLs. It needs its own origin, and that origin needs the same-origin `/api` door | bangnk | missing |
| P4 | Production secrets: `JWT_SECRET`, `JWT_REFRESH_SECRET` (≥16 chars — `config.schema.ts` refuses to boot otherwise), `SEED_OWNER_PASSWORD` ≠ `changeme` | The seeded owner password is public in this repo (`apps/be/scripts/smoke.sh`, the Playwright spec, the CI `e2e` job) | bangnk | missing |
| P5 | A `pg_dump` backup **and a proven restore**, taken before step 3 | Every migration `down` is a `DROP` ([rollback.md](./rollback.md) §Data implications). Without a restorable backup, the only schema reversal destroys the shop's data | bangnk | missing |
| P6 | The shop's real catalog CSV (~200 dresses, FR-CAT-04) | The importer exists and is proven (`catalog/list-dresses`); the data file does not live in the repo. An empty catalog means staff cannot book anything on day 1 | bangnk | tooling ok, data missing |
| P7 | TLS certificate for the chosen hostname(s) | The refresh token sits in `localStorage` and the access token rides in an `Authorization` header — over plain http both are readable on the wire | bangnk | missing |

## 2. Steps

| # | Step | Command / action | Owner | Verification |
| --- | --- | --- | --- | --- |
| 1 | Build the artifacts on the VPS from the released SHA | `pnpm install --frozen-lockfile && pnpm --filter be build && pnpm --filter fe build && pnpm --filter qr-admin build` | bangnk | three `dist/` directories exist; `pnpm contract:check` is clean on that same SHA |
| 2 | Take the backup (empty for r1 — run it anyway, this is the procedure's first rehearsal) | P5 | bangnk | the dump restores into a scratch database |
| 3 | Apply the schema | `pnpm --filter be migrate` | bangnk | 4 rows in `pgmigrations`; `\d rental_items` shows the `rental_items_no_overlap` EXCLUDE constraint |
| 4 | Seed the owner account | `pnpm --filter be seed` with the production `SEED_OWNER_PASSWORD` | bangnk | `POST /api/v1/auth/login` returns 200 for that pair, and 401 for `changeme` |
| 5 | Import the shop catalog | `pnpm --filter be import:dresses <csv>` (P6) | bangnk | `imported=N failed=0`, exit 0; `GET /api/v1/dresses` count matches the sheet |
| 6 | Start the API under PM2 (P1) | `pm2 start … && pm2 save` | bangnk | from the VPS: `GET /api/v1/dresses` without a token answers **401** (the app is up and the guard works); with a token, 200 |
| 7 | Publish both SPAs behind Nginx (P2, P3) | reload nginx | bangnk | staff SPA loads over https; a deep link (`/rentals`) is served, not 404; QR Admin loads on its own origin and its login works |
| 8 | Owner acceptance on the counter tablet | run the vi happy path by hand | bangnk + shop owner | book → hand out → take back & settle → the rentals list shows `Đã trả` and its payments — the same path `pnpm --filter fe e2e` automates |
| 9 | Observe for 48 hours | the watch list below | bangnk | nothing on the list trips |
| 10 | Record go/no-go | fill [`record.md`](./record.md) | bangnk | record committed; each feature's ledger `evidence` gains the release id |

**Ordering note.** The canonical template deploys BE first so an old FE keeps working. For r1 there
is no old FE, and this repo ships FE and BE as ONE unit from one SHA (root `AGENTS.md` invariant 5):
steps 6 and 7 are minutes apart and the mixed window is not a supported state (§3).

Watch list for step 9 — no dashboard exists, so each line names how bangnk actually looks at it:

- **Faults vs outcomes**: `pm2 logs --err`, `"level":50` (pino error). Any `{ error: { code: … } }`
  body reaching a user is a defect; `{ status: 'rejected_*' }` at 422/403 is the system working
  ([ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md)).
- **`rejected_dress_unavailable` rate**: a burst means the calendar or the 2-day cleaning buffer is
  wrong for this shop, not that customers are unlucky.
- **401 storm**: 401 means ONLY "a guard rejected the access token". A stream of them means the
  refresh-and-retry path is broken, and staff will be thrown to the login screen mid-rental.
- **`rental_items_no_overlap` violations in the log**: the app pre-checks, so a constraint error
  means the race path fired — expected to be rare and always ending in a 422, never a 500.
- **The KPI this product exists for**: the shop completes a full rental day without falling back to
  the Google Sheet.

## 3. Compatibility matrix

| Combination | What breaks | What degrades | Evidence |
| --- | --- | --- | --- |
| New FE + old BE | n/a for r1 — no BE is deployed to be the "old" one | — | Nothing in production. From r2 this combination exists only if step 7 lands before step 6, which the ordering forbids |
| New BE + old FE | n/a for r1 | — | Same. From r2 it exists for the minutes between steps 6 and 7 |

From r2 onward this matrix stops being trivial, and it is honest to say now that **nothing tests
it**: the FE and QR Admin clients are GENERATED from the BE contract, so a removed field, a renamed
`operationId` or a narrowed enum breaks the previous client immediately, and no consumer test pins
an old client against a new BE — `missing`. The compensating controls are invariant 5 (both sides
ship from one SHA, minutes apart) and the CI `contract` job, which fails when the two sides drift
*within* a SHA. Neither protects the rollout window; keeping it short is the whole mitigation.

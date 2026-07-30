# Session Handoff

## 2026-07-30 (6) — `catalog/manage-dress` = pass (update + retire + photo links)

- Done: the missing write-side of the catalog — BE migration 0003 `photo_urls text[]`
  (photos = staff-pasted LINKS; binary upload deliberately out of MVP),
  `SqlRepositoryBase.serialize` now maps JS arrays → `sql.array(..., 'text')`,
  `PATCH /dresses/:id` (partial merge: undefined keeps, explicit null clears
  sizeLabel/notes; code change re-checks uniqueness → 409) and `POST /dresses/:id/retire`
  (owner-only `dress:retire` policy from bootstrap, ONE-WAY, already-retired → 409);
  `pnpm contract`; FE DressFormDialog dual-mode (edit prefilled from the detail page,
  sends the FULL form with explicit nulls), photos textarea (one link per line, ≤10) +
  thumbnail strip on detail, retire button with confirm; `ui/textarea` added. All gates
  green both sides; smoke.sh now 26 checks; proxy proof (PATCH + retire via :5173).
  Evidence in `feature_list.json`.
- Next: EITHER a rentals LIST read slice / `rentals/today-board` (post-create navigation
  still lands on a shell), OR finish `catalog/list-dresses` (CSV seed import — the one
  remaining in-progress entry; photoUrls import can ride along now).
- Watch out:
  - Status model stays `active`/`retired` (bootstrap deviation vs the feature title):
    renting/cleaning are DERIVED from rentals — do not add them to the dress row.
  - PATCH semantics: omitted = keep, explicit null = clear. The FE edit dialog always
    sends the full form, so blank optional fields arrive as nulls and clear.
  - Retire is one-way ON PURPOSE — reactivation has no registered policy (fail-closed
    registry). Adding it = policy + command + FE, not just a status write.
  - `SqlRepositoryBase.serialize` assumes array columns are text[]; a non-text array
    column would need a smarter mapping.
  - smoke.sh (FRESH DB as always) now RETIRES VD-001 near the end — steps added after
    that must not book or rely on an active VD-001.

## 2026-07-30 (5) — `rentals/availability-check` = pass (dress detail live)

- Done: full README step-5 rhythm in one entry — BE 3 read slices (catalog `get-dress`;
  rentals `list-booked-ranges` + `check-availability` nested under `/dresses/:dressId/*` with
  `@ApiTags('rentals')`; availability mirrors the create precondition EXACTLY: asked period +
  CLEANING_BUFFER_DAYS tested against blocking blocked_periods, retired ⇒ never available),
  `pnpm contract`, FE `/dresses/:id` real (info grid + Monday-first month BookingCalendar with
  rented/buffer/free shading + AvailabilityChecker). Fixed a latent daterange bug on the way:
  slonik hands back PARSED RANGE OBJECTS, not literals — every SELECT of a range column now
  casts `::text` (also fixed the dormant `rental.repository.findOneById`). All gates green
  both sides; smoke.sh now 19 checks (get-dress 200/404; availability true / false:1 via the
  candidate's OWN buffer hitting a later booking / false direct / 400 / 404; booked-ranges
  3:2026-08-05) + Vite-proxy proof (get-dress, booked-ranges, availability through :5173).
  Evidence in `feature_list.json`.
- Next: EITHER `rentals/today-board` or a rentals LIST read slice (post-create navigation
  still lands on a shell), OR finish `catalog/list-dresses` (CSV seed import — the one
  remaining in-progress entry).
- Watch out:
  - slonik + daterange: ALWAYS cast `::text` when SELECTing range columns; the zod schemas in
    `sql.type(...)` are typing-only (no result-parser interceptor — nothing validates at
    runtime, failures surface as 500s in the mapper/projection).
  - `smoke.sh` still assumes a FRESH DB; it now also books 08-20..08-21 on VD-900 to isolate
    the candidate-side buffer.
  - BookingCalendar opens on the month of the first still-blocking booking (else current
    month); FE tests use 2099 fixtures to stay deterministic — keep that when adding tests.
  - The availability checker clears its result when an input changes, so the shown verdict
    always matches the submitted range.
  - The two detail suspense queries waterfall (get-dress → booked-ranges) — accepted at this
    scale, noted as deferred in the evidence.

## 2026-07-30 (4) — `rentals/create-rental` = pass (first cross-contract feature)

- Done: full README step-5 rhythm in one entry — BE slice `modules/rentals` (RentalPeriod VO,
  rentals+rental_items two-table aggregate with overridden repo insert/save/findOneById,
  DressLookupAdapter reading the dresses TABLE — no catalog imports; item price defaults to the
  dress standard price), `pnpm contract` (rentals tag → `useCreateRentalHttpControllerCreate`),
  FE `features/rentals` new-rental form (DressPicker search-add, vi-first keys, 409 → unavailable
  message). ALL gates green both sides; runtime proof: smoke.sh extended (rental 201; 409 when
  overlapping ONLY via the 2-day cleaning buffer; 201 past the buffer; 404 unknown dress; 400
  bad range) + psql bypass proof (EXCLUDE fires, blocking=false accepted) + Vite-proxy proof
  (201/409 through :5173). Evidence in `feature_list.json`.
- Next: EITHER `rentals/availability-check` (unblocks the dress-detail calendar — `/dresses/:id`
  is still a fetch-nothing shell) OR finish `catalog/list-dresses` (CSV seed import — the one
  remaining in-progress entry).
- Watch out:
  - `smoke.sh` now assumes a FRESH DB (`docker compose down -v && up -d && migrate && seed`)
    — fixed codes/dates make reruns 409.
  - daterange convention: domain uses INCLUSIVE `[start,end]`; Postgres stores half-open
    `[start,end+1)`; only `modules/rentals/database/daterange.ts` converts — never hand-build
    range literals elsewhere.
  - rentals reads catalog data ONLY via `DressLookupAdapter` (SQL on the dresses table);
    importing catalog code breaks the no-cross-module depcruise rule.
  - FE arch check (d) diffs `src/api/generated` against the COMMITTED state — it stays red on a
    dirty tree between `pnpm contract` and the commit; commit spec + client together.
  - Post-create the form navigates to `/rentals`, which is still a shell list.

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

# Session Handoff

## 2026-08-06 (17) — `qr/styled-svg-rendering` = pass

- Done: downloaded and previewed QR SVGs now use the shop's fixed red-pink styling: red-pink QR
  modules, pale-pink rounded frame, five hanging hearts and “Cảm ơn quý khách”. The QR library's
  output is nested unchanged inside the framed SVG, with its own white quiet zone; decorations
  therefore do not cover modules or alter the encoded direct URL. Error correction is `H`.
- Verification: focused renderer Jest test, `pnpm --filter be lint`, `pnpm --filter be build`, and
  `pnpm --filter be arch` all pass. No API contract changed; the existing authenticated Blob preview
  and SVG download automatically receive the new rendering.
- Next: close spec gap #5 — real-Postgres invariant proof plus CI postgres service and a real
  `pnpm --filter be test:e2e` script.

## 2026-08-04 (16) — `qr/create-url-code` = pass

- Done: BE `qr` supporting context owns immutable `qr_links` records (`target_url`, optional
  label, creator FK and created timestamp), strict `TargetUrl` validation, a `qrcode` SVG renderer
  adapter, and owner-only create/list/get/render endpoints. It never resolves or fetches a target
  URL. The API contract was emitted and both generated clients regenerated.
- Done: standalone `apps/qr-admin` now signs an owner in, validates and creates QR URLs, lists
  history newest-first, fetches protected SVGs as bearer-authenticated Blobs for preview/download,
  and keeps QR server data in TanStack Query. It does not import `apps/fe`.
- Verification: BE build/lint/arch/test (70 Jest tests); qr-admin check/lint/test/build. Contract
  freshness/root gates run after committing generated artifacts. No compose/live-browser proof was
  run; the existing BE real-Postgres `test:e2e` gap remains.
- Next: close spec gap #5 — real-Postgres invariant proof plus CI postgres service and a real
  `pnpm --filter be test:e2e` script.

## 2026-08-04 (15) — `infra/qr-admin-bootstrap` = pass

- Done: `apps/qr-admin/` is a separate Vite + React + TypeScript workspace, with no source
  import from `apps/fe`. It owns its `orval.config.ts`, generated client at
  `src/api/generated/`, bearer-aware API mutator and token-storage module, lightweight vi-first
  bootstrap shell, and check/lint/architecture/test/build scripts. It intentionally omits PWA,
  routing and feature UI until the QR endpoint contract exists.
- Done: root `generate:api`, `contract:check` and `check`, `init.sh`, and CI now cover BOTH
  frontend generated clients; CI adds an independent `qr-admin` quality job. Design/SRS status
  is approved. Evidence is recorded in `feature_list.json`.
- Next: promote **only** `qr/create-url-code`, then implement it as one BE `qr` context →
  `pnpm contract` → QR admin login/create/list/authenticated SVG-blob preview slice. Do not
  hand-edit either generated client, add a shell page as a substitute, or import `apps/fe`.
- Watch out: the current OpenAPI contract has no `qr-links` tag yet, so generated output only
  mirrors existing identity/catalog/rentals operations. The next feature must add BE endpoints
  first, then regenerate both clients. The QR admin refresh protocol and authenticated blob
  retrieval are deferred to that feature; its local token storage key is intentionally distinct
  from `apps/fe`.

## 2026-08-04 (14) — QR URL phase = design draft (awaiting approval)

- Done: SRS/design gate only — `docs/SRS-qr-url.md`, `docs/design/qr-aggregate.md`, and
  `docs/design/qr-admin.md`. QR encodes a direct http(s) target URL; no redirect, analytics,
  public endpoint, logo/custom style, or relation to dress/rental. `qr` is a new BE supporting
  context; `apps/qr-admin/` will be an independent Vite/React workspace sibling, not code inside
  `apps/fe`. It uses the same JWT/OpenAPI pipeline but owns its generated client and gates.
- Tracked, not started: `infra/qr-admin-bootstrap` then `qr/create-url-code`. Do **not** promote
  either to `in-progress` until the user approves the draft. Feature implementation remains one
  BE → contract → QR-admin entry after bootstrap.
- Watch out: SVG needs bearer-authenticated blob fetching; do not use `<img src>` with a token or
  put tokens in URL query parameters. `TargetUrl` permits direct http(s) only, forbids credentials,
  and BE must never fetch it (no SSRF surface).

## 2026-07-30 (13) — `infra/e2e-playwright` = pass (BACKLOG EMPTY — everything tracked is done)

- Done: Playwright in `apps/fe/e2e` — ONE serial vi-locale happy path against the real
  stack (sign in → create dress → single-day rental for today → board pickup → return
  with settled deposit → list shows Đã trả + payments dialog), green in ~5s. Config pins
  `locale: 'vi-VN'` (headless chromium defaults to en; the i18n detector follows it).
  **The e2e caught two real stale-cache bugs** (staleTime 60s): post-create landing
  missed the new rental, and pickup/return left the list showing the old status — the
  create/pickup/return mutations now invalidate the rentals LIST (parameterless key)
  alongside the board. vitest include narrowed to `src/**` (it was swallowing
  e2e/*.spec.ts); tsc guards e2e via tsconfig include. Root gates/init.sh still exclude
  e2e (needs browsers + running stack) — run recipe in `apps/fe/AGENTS.md` deviation 5.
  Evidence in `feature_list.json`.
- Next: nothing tracked. If the shop asks: wire e2e into CI (compose service +
  `playwright install --with-deps`), deposit COLLECTION recording at create (the
  payments read slice shows settlements only), reactivate-dress, per-item price
  override UI.
- Watch out:
  - The invalidate-after-mutation rule is now LOAD-BEARING: any new rentals mutation
    must invalidate BOTH the board and the list parameterless keys, or the 60s
    staleTime shows stale status — the e2e will catch it.
  - Playwright fills that race the lazy-route swap silently vanish — wait for the
    route heading, then fill (the happy path guards the first fill with toPass).
  - e2e assumes a FRESH DB only for determinism of the board counts; the unique
    E2E-<run> dress code lets reruns pass on a dirty DB too (counts are scoped to the
    run's customer string).

## 2026-07-30 (12) — `payments/list-payments` = pass (payments context gets its first code)

- Done: `modules/payments` born — GET `/rentals/:rentalId/payments` (@ApiTags payments
  nested under the rental path; RentalLookupAdapter existence check → 404; rows ordered
  `created_at, kind, id` because a settlement's rows share one transaction timestamp).
  FE: Thanh toán button on RETURNED rows of `/rentals` → RentalPaymentsDialog (lazy
  query while open, kind labels, formatVnd, empty state). smoke.sh 62 checks
  (2:deposit_refund:2800000:late_fee:200000 deterministic; unsettled 0; unknown 404) +
  proxy proof. Evidence in `feature_list.json`.
- Next: `infra/e2e-playwright` — the last tracked todo.
- Watch out:
  - The write side of payments DELIBERATELY stays in rentals (PaymentRecorderAdapter);
    move it only when payments grows real use cases (deposit collection at create would
    be the trigger).
  - Payment rows within one settlement share created_at — any new ordering must keep a
    deterministic tie-break (kind today).
  - formatVnd in vitest reads the APP i18n instance (not the test instance) — currency
    assertions must accept both vi and en digit grouping.

## 2026-07-30 (11) — `rentals/cancel-rental` = pass (calendar frees at the DB level)

- Done: `POST /rentals/:id/cancel` — booked ONLY (out → 409, it must be returned;
  returned/cancelled → 409); `RentalEntity.cancel` flips every item to
  `blocking=false` via `RentalItemEntity.unblock()`, and the repo's existing item
  upsert persists it. FE: Huỷ button on booked rows of `/rentals` (confirm → mutate →
  invalidate list + board). smoke.sh 59 checks — the star proof: cancel → availability
  flips false→TRUE → REBOOK of the same dress+dates 201 (EXCLUDE ignores non-blocking
  rows) — plus proxy proof. Evidence in `feature_list.json`.
- Next: `payments/list-payments`, then `infra/e2e-playwright`.
- Watch out:
  - Cancel from the BOARD was deliberately left out (list only) — due-out cards offer
    pickup, not cancel; add it there only if staff ask.
  - smoke.sh now leaves TWO 10-01..10-02 rentals on VD-900 (one cancelled, one booked)
    and the 08-20 rental OUT — later fixture additions must account for that.

## 2026-07-30 (10) — `rentals/list-rentals` = pass (no shells left)

- Done: the follow-up backlog became 4 tracked entries (list-rentals, cancel-rental,
  payments/list-payments, infra/e2e-playwright) and the first shipped end-to-end:
  `GET /rentals?q=&status=&page=&limit=` mirroring the list-dresses shape (q searches
  customer name OR phone; newest first; pages over RENTALS with items + dress names
  riding along via `rental-list.projection` + `DressLookupPort`); FE `/rentals` is REAL —
  filters bar, table (tel: links, dress-code links, status badges), pagination, URL-owned
  q/status/page (`use-rental-filters`). `TodayBoardDressDto` was promoted to the shared
  `RentalDressDto` (contract rename, generated-only impact). All gates green; smoke.sh
  49 checks + proxy proof. Evidence in `feature_list.json`.
- Next: the remaining tracked todos, easiest-first suggestion: `rentals/cancel-rental`
  (domain method + `blocking=false` flip — the repo save already upserts items, and the
  EXCLUDE constraint ignores non-blocking rows), then `payments/list-payments` (first
  read surface of the payments context, probably nested under the rental), then
  `infra/e2e-playwright` (compose stack, the deferred bootstrap item).
- Watch out:
  - GET /rentals vs GET /rentals/today-board coexist because today-board is a literal
    segment — a future `GET /rentals/:id` MUST be registered so Nest keeps today-board
    first, or the uuid pipe will eat 'today-board' (Nest orders by controller
    registration; today-board's controller is listed before any :id route would be).
  - The list pages over rentals; the items query hits only the PAGE's rental ids — do
    not "simplify" into one JOIN, it breaks LIMIT/OFFSET semantics (item rows multiply
    rentals).
  - jsdom cannot open the Radix Select popover — drive status filters via the URL in
    tests (both list tests do this).
  - smoke.sh list checks assume EXACTLY the 4 fixture rentals with their customer names
    and the 08-01 one returned — inserting new rentals earlier in the script shifts
    `4:4:Phạm Thị D` and the count-based expectations.

## 2026-07-30 (9) — `rentals/return-rental` = pass (FEATURE LIST COMPLETE)

- Done: the last todo entry, full step-5 rhythm — BE status machine (`markPickedUp`
  booked→out, `markReturned` booked|out→returned; returned/cancelled → 409) behind
  `POST /rentals/:id/pickup` and `POST /rentals/:id/return`; the return body
  `{lateFee?, damageFee?, depositRefund?, note?}` becomes payments ROWS via
  `PaymentRecorderPort` (adapter writes the payments-owned table directly — the payments
  context is schema-only, same boundary trick as `DressLookupAdapter`; zero/blank amounts
  are not recorded; the note rides on every row). today-board grew an OVERDUE list
  (booked|out with end < date) so late returns keep a surface. FE: the board is actionable
  (pickup button on due-out, return-and-settle dialog on due-back + overdue). All gates
  green; smoke.sh 43 checks + psql payments proof + proxy proof. Evidence in
  `feature_list.json`. **Every feature_list entry is now pass.**
- Next: no tracked entries remain. Natural follow-ups if the shop asks: a rentals LIST
  read slice (`/rentals` is still a shell — the only one left), cancel-rental (enum +
  `blocking=false` semantics already exist in the DB), early-return shrinking
  `blocked_period`, a payments read slice (rows are write-only today), Playwright e2e
  (still deferred from bootstrap).
- Watch out:
  - Return records ONLY what staff typed — no deposit ledger exists (deposit collection
    was never recorded at create), so `depositRefund` is an entered amount, not a
    computed one. A future payments read slice should not pretend otherwise.
  - Settlement ordering: rental flips to returned BEFORE payment rows land; a recorder
    crash means re-entering fees by hand (re-return is 409 by design). Never reverse the
    order — fees on a never-returned rental are worse.
  - Overdue is unbounded history by design (every unreturned past rental, forever) —
    fine at shop scale; revisit only if the board ever slows.
  - The 409 toast on pickup/return says "already processed" — the FE cannot tell
    already-out from already-returned (contract has no typed error body).
  - smoke.sh mutates state late in the run: the 08-01 rental ends RETURNED, the 08-06
    rental stays booked, VD-001 is retired. New checks must slot in AFTER the today-board
    reads (which assume everything still booked) or re-derive their fixtures.

## 2026-07-30 (8) — `rentals/today-board` = pass (the morning screen is live)

- Done: full README step-5 rhythm in one entry — BE read slice `GET /rentals/today-board?date=`
  (auth-only read; due OUT = booked rentals starting on the date, due BACK = booked/out rentals
  whose INCLUSIVE last day is the date, i.e. `upper(period) - 1`; membership computed as SQL
  flags, `today-board.projection` groups item rows per rental — a single-day rental lands on
  BOTH lists). `DressSnapshot` grew `code`+`name` (adapter SELECT widened) so the board names
  dresses without touching catalog code. `pnpm contract`; FE `/` (index) is the real board:
  two sections with counts, tel: links, status badges, dress codes linking to `/dresses/:id`,
  and a date input that ALWAYS sends the device-local day. All gates green both sides;
  smoke.sh now 33 checks (due-out 1:0:VD-900 / due-back 0:1 / single-day 1:1:same-rental /
  quiet 0:0 / 2026-02-30 → 400 / no-date → 200) + proxy proof through :5173.
  Evidence in `feature_list.json`.
- Next: `rentals/return-rental` (the LAST todo entry: settle deposit, late/damage fees,
  status transitions booked→out→returned — the board's status badges start earning their
  keep once 'out' exists), or a rentals LIST read slice (post-create navigation still lands
  on a shell at `/rentals`).
- Watch out:
  - Board semantics are status-aware ON PURPOSE: due-out only `booked` (an 'out' rental is
    already with the customer), due-back `booked|out` (a 'booked' rental on the due-back list
    means the customer never picked up). 'returned'/'cancelled' never appear.
  - The FE always sends `?date=` (device-local via `localDateIso`) — the server default
    exists for curl convenience only; a UTC server flips dates at 7am Hanoi.
  - `GetTodayBoardRequestDto` pairs @Matches with @IsISO8601 strict: calendar nonsense like
    2026-02-30 must 400 BEFORE the `::date` cast (which would 500). Copy that pairing for
    future date query params.
  - Background processes started inside a `wsl.exe` call die when the session exits — for
    runtime proofs, run start-app + smoke + kill in ONE script file invoked as
    `wsl.exe -- bash /tmp/script.sh` (a file dodges the fish-wrapper $-mangling too).
  - smoke.sh (FRESH DB as always) now books VD-900 on 2026-09-20 (single-day) — steps added
    later must not assume 09-20..09-22 is free on VD-900.

## 2026-07-30 (7) — `catalog/list-dresses` = pass (CSV seed import closes the entry)

- Done: `pnpm --filter be import:dresses <file.csv>` — `src/scripts/import-dresses.ts` boots
  the Nest app context (emit-openapi precedent) and dispatches `CreateDressCommand` per row,
  so domain rules + the duplicate-code precondition apply exactly as over HTTP; duplicates are
  SKIPPED (idempotent re-run), failures reported per record, exit 1 when any row failed.
  Parser `src/modules/catalog/import/dress-csv.ts` (hand-rolled RFC4180 subset: quoted
  commas/newlines, escaped quotes, BOM, CRLF; header any order/case, fail-fast on wrong
  shape; vi/en price formats normalized) + 9 specs. Template `apps/be/seed/dresses.sample.csv`.
  Photos deliberately NOT in the sheet (per user) — pasted later via the edit dialog.
  No API change → contract untouched, FE untouched. Runtime proof on a fresh DB: sample=3,
  200-row generated CSV imported (exit 0), re-run all-skipped (exit 0), bad CSV → exit 1 with
  per-record messages and good rows still imported; API count=204, comma-in-name + formatted
  prices verified on VD-550. Evidence in `feature_list.json`.
- Next: `rentals/today-board` or a rentals LIST read slice (post-create navigation still
  lands on a shell) — the catalog context is now COMPLETE (all its entries pass).
- Watch out:
  - The import needs the real DB (.env) and is NOT part of smoke.sh — smoke keeps assuming a
    fresh, empty catalog (fixed VD-001/VD-900 codes).
  - The importer sets `LOG_LEVEL ??= 'warn'` pre-boot (an exported LOG_LEVEL wins; the .env
    debug value is deliberately bypassed) — 200 rows would otherwise print 200 event lines.
  - Header contract is fail-fast: wrong/unknown columns abort BEFORE any insert; per-row
    problems (bad code format, non-numeric price) skip only that row.
  - `parseVndAmount` strips `. , space ₫ đ` — a price given in "1tr5" style is rejected, not
    guessed.

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

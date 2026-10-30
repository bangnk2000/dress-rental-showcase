# Progress Log

Append-only, newest first (`docs/spec/init-harness/02-artifacts-and-templates.md` §2.4). Detail per
session — evidence, decisions, watch-outs — lives in `session-handoff.md` (latest 5) and
`docs/harness/session-handoff-archive.md` (older, same `(N)` numbers); this file is the index.
Never needed on resume — add your line at the top without reading further.

- 2026-10-30 (50) — owner "hãy thực hiện các đề xuất" / "có": spec re-sync to upstream `518495c` (version 2026.10.30,
  knowledge-system#1) + SHA256SUMS CI gate, new ledger.mjs (`pending`), ownerPending/deploy on 3 entries,
  SRS status column dropped, CODEOWNERS + PR template. Docs/harness only; ledger 50/50.

- 2026-10-27 (49) — owner "hiện thị thêm mã váy gốc cho mẫu váy được publish": `catalog:public-base-code`
  = pass (50/50). Public DTO `codes` (base codes of active dresses), web card + detail. Not deployed.

- 2026-10-15 (47) — owner "có" (record the deploys): docs only. Web-only deploys `1472e07` (PR #27)
  and `5d797b1` (PR #28, after a Codex round + e2e clock-race fix) recorded in ledger + Current state.

- 2026-10-15 (46) — owner "làm cả 2" (compress + Cloudflare-resize the site's own images, not R2):
  `web:static-images` = pass (48/48). Sources 640 → 144 KB; loader env `NEXT_PUBLIC_STATIC_IMAGE_BASE_URL`.
  (45) `web:open-graph` merged PR #27 + deployed web 1472e07. Not deployed yet.

- 2026-10-15 (45) — owner "hãy làm đi" (Threads shows no thumbnail for example.com):
  `web:open-graph` = pass (47/47). og:*/twitter:* on every public page via `src/lib/seo.ts`. web gates
  green, crawler-UA smoke on the standalone build. Not deployed.

- 2026-09-30 (40) — owner "triển khai đi" / "chạy thật luôn" / "làm luôn": release `2026-09-30-r2`
  DEPLOYED to Tencent (`a4d32cb`: R2 photos, listings, public site example.com); listings tool on prod
  → 100 drafts. Readiness pack written after the rollout (says so). Ledger unchanged at 43/43.
- 2026-09-30 (39) — owner ask "lên kế hoạch triển khai web + tính năng mới bên CMS", web on the apex
  `example.com`: `infra/web-standalone` = pass (43/43). `output: 'standalone'` (43 MB, ~100 MB rss),
  bind rule HOSTNAME=localhost (127.0.0.1 → 307 loop / 500 behind https proxy). web gates green.
  PR #22. Deploy runbook §11 + scripts written outside the repo (`~/deploy-dress/tencent/`). Not deployed.
- 2026-09-30 (38) — owner ask "tool tạo hàng loạt mẫu trên website từ váy mã VAY":
  `be:listings-from-dresses` = pass (42/42). CLI, one draft listing per code group, styles from
  name keywords (fallback silk), re-run safe. be unit 288; dev DB 95 created, re-run 0. PR #21 (Codex round 2 APPROVE). Not run on prod.
- 2026-09-30 (37) — owner ask "bắt đầu làm web:public-catalog-live": = pass (41/41). Web reads the
  live public catalogue (ISR 300 s), mock deleted, Cloudflare Images loader. web vitest 33,
  build with/without BE, runtime proof on next start. PR #20 (Codex APPROVE after 1 rebuttal, CI green) → master. Not deployed.
- 2026-09-30 (36) — owner ask "đổi 'dịp' thành 'loại'": `catalog/listing-styles` = pass (40/40).
  Six style codes (short, silk, ao-dai, off-shoulder, sleeved, strappy-strapless), field renamed
  DB → API → 3 clients, migration `1755600000000_listing_styles`. be e2e 148/148, fe 167.
  PR #19 (2 Codex P2 fixed, round 1 APPROVE, CI green) → master. Not deployed.
- 2026-09-29 (35) — owner ask "triển khai catalog/public-listing": = pass (39/39). DressListing
  aggregate + migration, listing commands, first anonymous API `/public/dresses[/:slug]`
  (whitelist, throttled), CMS `/website`. be 263 unit, e2e 145/145, fe 167, Playwright 1/1.
  PR #18 (1 Codex P1 fixed `555bac6`, APPROVE, CI green) → master. Not deployed.
- 2026-09-29 (34) — owner ask "upload ảnh khi submit form, tối ưu upload/đọc R2":
  `catalog/photo-upload-on-submit` = pass (37/37): photos reach R2 only on Save, one batch
  signing request, dress saved only if every PUT succeeded, no read-back of fresh uploads, detail
  160/1280 variants (§9). be 208 unit, photo e2e 13/13, fe 139. PR #16 via the new
  `pr-codex-review` skill (1 Codex P1 fixed, round 1 APPROVE, CI green) → master `a1881f0`. Not deployed.
  Also: e2e harness pins the cleaning buffer (6 local-only rentals failures fixed, 110/110).
- 2026-09-25 (33) — owner ask "backend + CMS phục vụ `apps/web/src/api/mock`": specs
  `catalog/public-listing` (FR-CAT-09) and `catalog/dress-photo-upload` (FR-CAT-10/11) approved;
  the latter built = pass (36/36): BE-signed browser→R2 PUT, `PhotoListField` in the dress form,
  Cloudflare Images variants via `packages/image-url`. be 207 unit / 108 e2e, fe 131, image-url 8;
  real dev-bucket browser proof passed. Merged to master by PR #15 (`50893c2`, 2026-09-26, after one Codex fix:
  CI scope runs the web job on `packages/image-url` changes). Not deployed.
- 2026-09-25 (32) — owner ask "dựa vào apps/web/design/prototype break tasks và triển khai code với
  mockapi data trước": `web:public-pages` = pass (35/35). Tasks T1–T8 + rendering + BE change-request
  draft in `docs/design/web/public-pages.md` (FR-WEB-01..04 added to the SRS). Home, /bo-suu-tap,
  /bo-suu-tap/[slug], /lien-he built from the prototype on an in-process mock catalogue
  (`apps/web/src/api/mock/`), all ● SSG. web check/lint/arch/test (24)/build green; runtime +
  Playwright at 390/834/1440: no overflow, no target under 44px, no console errors. NOT committed.
- 2026-09-24 (31) — owner ask "dựng khung public web bằng init-nextjs, chưa làm tính năng":
  `infra/web-bootstrap` = pass (34/34). `apps/web` Next.js 16 skeleton (anonymous, vi-only,
  SSG placeholder home, third generated client, `/api/v1` rewrite) wired into root scripts,
  init.sh and CI; `init.sh` green. init-nextjs + init-monorepo-contract fixed upstream (monorepo
  mode, session model 0, add-a-client checklist, 7 verified bugs) and re-vendored. Web design
  system (DESIGN.md) applied: frontmatter roles, dark theme measured from the demo board.
  Merged to master by PR (branch `feat/web-bootstrap`).
- 2026-09-18 (30) — owner ask "sửa đơn + chi tiết đơn cho chủ cửa hàng": `rentals/update-rental`
  = pass (33/33). Spec (`docs/design/rentals/update-rental.md`, FR-RENT-12/13) and code in one
  session: `GET /rentals/:id` for every staff member, owner-only `PATCH /rentals/:id` that
  re-blocks every item, reconciles dresses by id and re-reads status under the row lock;
  FE `/rentals/:id` + `/rentals/:id/edit` on a shared `RentalForm`. be 185 unit / 98 e2e, fe 117,
  Playwright 1 passed. Committed `baa74ab`, pushed to origin and deployed to the LAN instance at
  the owner's request (2026-09-19); the 9 spec §6 defaults await the owner's answers.
- 2026-09-18 (29) — owner ask on the today board: a rental marked "Đã giao váy" now STAYS on the
  day's hand-out list (BE due-out = `booked` OR `out` starting that day, booked first; FE shows a
  done marker instead of the button). Read-side only — no migration, contract description-only.
  Gates green (be 169 unit / 86 e2e with `CLEANING_BUFFER_DAYS=2`, fe 104, Playwright 1 passed);
  committed on master and deployed to the LAN instance at the owner's request (pickup button
  renamed "Giao váy" by the owner in the same commit). Side findings: the shop's buffer is 1 day
  (one pre-existing overlap e2e expectation and CI still assume 2), and `localprod-deploy.sh` no
  longer clobbers the instance's buffer / late-fee settings on redeploy.
- 2026-09-03 (28) — three owner asks, two features, ledger 32/32 `pass` (committed and merged to master by PR at
  the owner's request): `rentals/rental-discount` (FR-RENT-11 — a rental-level
  discount column with the ≤ Σ rule held by the aggregate and the ≥ 0 rule by a CHECK; the new-rental
  form reads the digits back grouped and shows subtotal / discount / payable; the collect form
  suggests the discounted fee) and `catalog/duplicate-dress` (FR-CAT-08 — `POST /dresses/:id/duplicate`
  numbers copies `<code>_1`, `_2`, … from the ORIGINAL even when copying a copy, survives the
  concurrent race through UNIQUE + recount, and the FE asks only for the size; sizes everywhere are
  now XS/S/M/L/XL buttons with a legacy value kept as a sixth). be 168 unit + 86 e2e on real
  Postgres, fe 103 vitest, both builds green; fe arch (d) and `contract:check` red only until the
  regenerated client is committed.
- 2026-08-10 (24) — the repo's whole unpushed history (18 commits) went out as **five stacked PRs**
  (#1 QR phase → #2 outcome model + invariant proof → #3 e2e CI + release record → #4 UI review
  batch → #5 FR-PAY-02), each reviewed by the codex CLI in WSL and fixed until the review returned
  nothing: 20 findings, most of them in the money paths — a TOCTOU on recording money, two screens
  reading a failed/loading ledger as "nothing collected", a settlement basis that could be raced
  past until the check moved under the rental's row lock, a catalog duplicate answering 409 or 422
  depending on who won, and a QR admin that never used its refresh token. ADR 0001 gained the
  general rule: a pre-check and the DB constraint behind it are two guards of ONE rule, and the
  client must not be able to tell which fired. init.sh green at the tip (be 114 + 46 e2e, fe 83,
  qr-admin 17) plus Playwright. Nothing merged — the stack merges in order, #1 first.
- 2026-08-10 (23) — `payments/record-collection` = pass (FR-PAY-02), ledger 25/25. The deposit the
  shop TAKES is finally written down, and the refund at return is computed from it instead of from
  the catalog. Spec-before-code again: the rules went to the owner as blocker questions and came back
  as four decisions (standalone action usable any time · pre-filled but editable amounts, ledger
  records what was taken · fees ARE deducted from the deposit — closing the assumption session 22
  recorded · rental fee in scope too). The `payments` context grew its first aggregate + command, and
  BR-7 ("one deposit and one rental fee per rental") is enforced by two partial UNIQUE indexes, with
  the concurrent race, the repeat call and a raw INSERT all provoked on real Postgres. Read side
  gained `summary`; `RentalDressDto` gained `agreedPrice`. be 109 unit + 42 e2e, fe 71, qr-admin 13,
  all root gates and Playwright green — the browser run is what caught the return dialog serving a
  stale ledger, now a recorded invalidation rule.
- 2026-08-10 (22) — UI/UX review of `apps/fe` (22 findings across the whole SPA), then its top four
  groups shipped as four features, ledger now 24/24 `pass`. `rentals/settlement-clarity`
  (cross-contract: `RentalDressDto.depositAmount` → the return dialog pre-fills the refund with
  `deposit − suggested late fee`, states the arithmetic live and reads every amount back grouped —
  the only screen that moves cash was asking for a seven-digit number from memory; the deduction
  convention is a RECORDED ASSUMPTION, not an owner decision). `rentals/dress-availability-in-picker`
  (each chosen dress checks itself against the form's dates; a rejection marks the exact dresses
  `dressIds` names, which ADR 0001 designed for and the form was discarding).
  `catalog/dress-thumbnails` (photos where dresses are CHOSEN, not only on the detail page).
  `fe:board-and-confirm-ergonomics` (day stepping in a transition so the board stops blanking, ±day
  + `Hôm nay`, 44px actions, per-row spinner from `mutation.variables`, customer in the accessible
  name, and `window.confirm` replaced by an in-app AlertDialog whose dismiss says `Quay lại`).
  fe 66 tests, be 95 + 30 e2e, qr-admin 13, all root gates and the Playwright happy path green.
  `docs/releases/2026-08-10-r1/` now names these four as explicitly NOT covered by its readiness pass.
- 2026-08-10 (21) — `infra/e2e-ci` = pass, and the repo's FIRST release record. The browser proof
  stopped being manual: `playwright.config.ts` starts the BE and the FE **production build**
  (`vite preview` :4173, `preview.proxy` added to `vite.config.ts`) itself, so `pnpm --filter fe e2e`
  is one command locally and in CI; `E2E_BASE_URL` opts out of that entirely. New CI `e2e` job with
  its own postgres, migrate + seed, chromium, and report/trace uploaded on failure. Proven cold
  (18.2s) and with `CI=1` (17.1s); the opt-out branch proven by 0 `[WebServer]` lines against a dead
  port. Then the `init-release` lane ran for real → `docs/releases/2026-08-10-r1/`: 20 readiness
  files, release plan (risks R1–R4, prerequisites P1–P7, ordered steps, compatibility matrix),
  rollback plan, seeded record, index. It found what a uniform `pass` ledger hides — no deployment
  artifact exists at all, NFR-03 same-origin is load-bearing because CORS is never enabled, every
  migration `down` is a `DROP` so reversal is safe exactly once, there is no observability or flag
  anywhere, and the `qr` slices have no live-DB/browser/print proof. Ends at "STOP — awaiting
  go/no-go"; nothing was deployed and nothing is committed.
- 2026-08-10 (20) — `rentals/settle-late-fee` (FR-RENT-09) = pass — the first capability driven
  through the `init-feature-spec` lane: spec `draft` with the business rules left as blocker
  questions, contract check on the draft, owner decisions recorded in §6, THEN code, then an as-built
  re-sync (§7). Late fee = days late × dresses × 200.000₫ (buffer excluded), computed by a pure
  domain value object that both the read and the write path call; waiver is owner-only and needs a
  reason, surfacing the repo's first 403 outcome. be 95 unit + 30 e2e, fe 57, qr-admin 13, all root
  gates + Playwright green. Side fix: `lib/format.ts` no longer reads the i18n singleton (money
  formatted en-style under test while the UI was vi).
- 2026-08-09 (19) — Process-conformance refactor, docs AND code. Design gate first: ADR 0001
  (outcome model + full outcome catalog + UI state matrix) approved, SRS/design docs re-synced to it,
  `docs/design/README.md` gained the B2.1 outcome-catalog lane and an ADR index. Then the two MUST
  gaps were closed as tracked features: `infra/outcome-model` (BE `BusinessOutcomeException` +
  `{ error: … }` envelope + 9 controllers rendering named 422 outcomes with typed payloads → contract
  → one `mapApiError` seam in both clients, three `is-conflict-error.ts` files deleted) and
  `infra/invariant-proof-e2e` (22 tests on real Postgres provoking the EXCLUDE/UNIQUE/CHECK
  constraints, `pnpm --filter be test:e2e`, CI postgres service, real gate in `init.sh`).
  `apps/qr-admin` finally has its own app-level contract, and the `AGENTS.md` files were cut back to
  routing + pointers so detail is read on demand. Committed on
  `feat/outcome-model-and-invariant-proof`; every gate green including `bash init.sh` and the
  Playwright happy path on the real stack (which needed two fixes to be runnable as documented:
  `seed-owner.cjs` now loads `.env`, and the board locators are scoped to the run's own rows).
  Next: a first `docs/releases/` record via `docs/spec/init-release/`.
- 2026-08-09 (18) — Doc/spec maintenance session, no product code. `docs/spec/` re-synced from
  `knowledge-system` `815fa0f`: four sets refreshed, `init-feature-spec` + `init-release` added,
  new `docs/spec/README.md` records provenance + the one local delta + the re-sync recipe. The new
  upstream standard (business outcomes survive the boundary: `BusinessOutcomeException` outcome
  bodies, `{ error: { … } }` envelope, FE `mapApiError`, `Idempotency-Key`) is NOT implemented here,
  so it is recorded as `apps/be/AGENTS.md` #6 and `apps/fe/AGENTS.md` #8 — one cross-contract change,
  to be done in one go. Harness artifacts caught up with the repo: root `AGENTS.md` (spec entry
  points, design gate, `acceptance` field, honest gate list), `clean-state-checklist.md`,
  `init.sh` + CI comments (dead "README step 2/4" pointers replaced), README doc index, and this
  log's 2026-07-30 → 2026-08-06 backfill. Next: spec gap #5 (real-Postgres invariant proof).
- 2026-08-06 (17) — `qr/styled-svg-rendering` pass: rendered SVGs get the shop's red-pink frame,
  hearts and thank-you caption, all outside the QR quiet zone; error correction `H`.
- 2026-08-04 (14–16) — QR URL phase, three sessions: design gate first (`docs/SRS-qr-url.md`,
  `docs/design/qr-aggregate.md`, `docs/design/qr-admin.md`), then `infra/qr-admin-bootstrap` (the
  independent `apps/qr-admin` Vite/React workspace with its own generated client + gates; root
  contract/CI extended to both clients), then `qr/create-url-code` (owner-only immutable `qr_links`,
  strict direct-http(s) `TargetUrl`, offline SVG rendering, bearer Blob preview/download).
- 2026-08-04 — Intent docs backfilled as-built (dated 2026-07-31/08-02 in-session): `docs/spec`
  design-first re-sync (`b219f3a`), then `docs/SRS-dress-rental.md` + four per-context tactical
  designs with invariant-enforcement tables (`f215d7b`).
- 2026-07-30 (4–13) — MVP feature rhythm, all `pass`, one entry per session:
  `rentals/create-rental` (first cross-contract feature, DB EXCLUDE overlap constraint) →
  `rentals/availability-check` (dress detail live) → `catalog/manage-dress` →
  `catalog/list-dresses` (+ CSV seed import) → `rentals/today-board` → `rentals/return-rental`
  (pickup/return + settlement) → `rentals/list-rentals` (no shell routes left) →
  `rentals/cancel-rental` → `payments/list-payments` → `infra/e2e-playwright`
  (vi-locale happy path vs the real stack; tracked backlog empty).
- 2026-07-30 (3) — FE bootstrap complete (`infra/fe-bootstrap` pass). React 19 SPA in
  `apps/fe`: Orval client from the real contract, auth (bearer+refresh) + dresses slices,
  rentals/today shells, PWA + vi/en i18n; guardrails: check-architecture.sh (`pnpm arch`),
  plop feature generator, boundaries v7 migration, `apps/fe/AGENTS.md`. All root gates green;
  runtime proof via Vite proxy against compose stack (login 200, list 200, 401, 201/409).
- 2026-07-30 (2) — BE bootstrap complete (`infra/be-bootstrap` pass). NestJS 11 hexagonal in
  `apps/be`: libs kernel (ddd/db/authz/exceptions/config/logging), identity (JWT + ABAC),
  catalog proving slice, migrations incl. rental_items EXCLUDE constraint, offline
  `openapi:emit` → `packages/contract/openapi.json`, plop scaffolds, dep-cruiser + eslint
  gates, smoke.sh runtime proof. Next: FE bootstrap.
- 2026-07-30 — Repo created from `init-monorepo-contract` spec (knowledge-system). Skeleton:
  pnpm workspace, `packages/contract/`, CI drift gates, root harness artifacts, four prompt
  sets copied to `docs/spec/`. Apps pending bootstrap.

- 2026-10-02 (41) — Public search request: FR-WEB-06 proposed, design draft
  `docs/design/web/search-dresses.md`, ledger `web:search-dresses` = todo. Verified
  current collection loads all summaries; name/tagline are available for local filtering.
  Await scope/design approval per root design gate; no app/API/generated changes.
  Clean-state review: docs/ledger only; init.sh, tests/build/runtime deferred until approval;
  no pass claim, no as-built stamp, no commit/deployment.

- 2026-10-02 — Search design follow-up: owner requires debounce. Added proposed 300 ms
  delay for grid/count/URL and AC6 timer proof; immediate Enter/clear/reset/style/navigation
  cancel pending work. Design remains draft; documentation changes only, diff check passed.

- 2026-10-02 (42) — Owner approved public search design before implementation.
  `web:search-dresses` = pass, 44/44 ledger. Public name/tagline search supports accent folding,
  debounce 300 ms, chip intersection and q/style URL; immediate Enter/clear/reset/chip and
  navigation/unmount cancel stale timers. web tests 44/44; root contract/check/lint/arch/test,
  FE/QR builds green. webpack web production build and Chromium smoke (8 fixture summaries)
  pass: real history/reload, keyboard, mobile/tablet/desktop, cached HTML/canonical/detail.
  Environment: Turbopack internal port restricted; webpack fallback used without config change;
  baseline init.sh explicitly skipped invariant e2e without compose DB. Not deployed.
  Clean-state checklist reviewed: ledger/evidence/design/SRS/handoff updated, generated layers
  unchanged, vendored specs untouched. Baseline init.sh full success and DB invariant gate remain
  environment-limited as recorded; webpack production build supplies web validation.

- 2026-10-03 (43) — Owner asks “Xem thêm” and filter continuity. Mechanical follow-up
  `web:featured-filter-link` pass, 45/45 ledger: featured CTA passes selected style to existing
  collection URL contract; all omits style. Web tests 44/44, check/lint/arch green; Chromium
  actual navigation short/ao-dai/all + reload pass on existing :3001 dev server (left running).
  Clean-state review: SRS/design/ledger/handoff/root Current state synced, generated/spec
  layers unchanged. Scoped web checks; no backend/full rebuild needed for this link/copy change.
  No deploy.

- 2026-10-03 (44) — Owner asks fix/push PR #26 P2. `web:catalog-router-sync` pass, 46/46
  ledger. Added router query observer under Suspense; history null user data lets Next
  preserve internal state and publish URL updates. External navigation cancels timers;
  own notifications retain newer drafts. Web unit 46/46, check/lint/arch green; Playwright
  2/2 on dev and production, webpack build ISR 5m. CI web now runs URL regression tests.
  Clean-state review: design/handoff/ledger/root map updated, generated layers unchanged.
  Scoped web evidence recorded; backend invariant tests unaffected and not rerun. No deploy.

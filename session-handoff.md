# Session Handoff

## 2026-09-18 (29) — today board keeps the day's hand-outs visible (owner ask)

- Done: the owner asked (board screenshot) that a rental marked "Đã giao váy" stays on the day's
  board instead of vanishing. `rentals/today-board` due-out is now every rental STARTING on the
  date with status `booked` OR `out`; the projection lists the still-to-hand-out (`booked`) ones
  first, then the handed-out ones. FE: an `out` card on the hand-out list shows a muted
  "Đã giao cho khách" check instead of the pickup button (new `today:handedOut` key, vi/en); the
  badge already read `Đang thuê`. Contract re-emitted (description-only change on
  `TodayBoardResponseDto.dueOut`), BOTH generated clients touched. SRS FR-RENT-07 re-worded,
  `rentals/today-board` evidence appended, smoke.sh "D0 after pickup" expects `1:out`, the
  Playwright happy path asserts the card stays (customer count 2, done text, no button).
- Numbers: be 169 unit (+1 projection spec) · 86 e2e on real Postgres · fe 104 vitest (+1) ·
  check / lint / both builds green · Playwright `1 passed (23.6s)` on the real stack · arch and
  `contract:check` red only on the freshness diff of the regenerated client while uncommitted.
- Committed on master at the owner's request (two commits: the feature, then the owner's own
  `.env.example` 2 → 1 edit) and deployed to the LAN instance with
  `~/deploy-dress/localprod-deploy.sh`. That script used to HARD-CODE `CLEANING_BUFFER_DAYS=2` and
  `LATE_FEE_PER_DRESS_PER_DAY=200000` into the instance's `.env` on every run — it would have
  clobbered the 1 / 20000 the shop actually runs (set later by `set-buffer-local.sh` /
  `set-latefee-local.sh`); it now keeps whatever the existing `.env` says and falls back to the
  defaults only on a first install. NOT pushed to origin (the owner asked for the LAN, not GitHub).
- The owner renamed the pickup button to "Giao váy" (`today:actions.pickup`, vi "Giao váy" / en
  "Hand out"); `errors.returnNotPickedUp`, which quotes that button, was updated to match. The
  accessible name (`actions.pickupFor`, "Đã giao váy cho …") is unchanged, so every locator still
  resolves.
- Watch out: `pnpm --filter be test:e2e` fails ONE test locally (`rentals-overlap` BR-1 cleaning
  buffer: expects 422, gets 201) — pre-existing at HEAD `5a0ea7d`, NOT a code bug: the gitignored
  `apps/be/.env` has `CLEANING_BUFFER_DAYS=1` while the test, `.env.example` and CI assume 2, and
  `test/load-env.ts` feeds .env into the harness. `CLEANING_BUFFER_DAYS=2 pnpm --filter be
  test:e2e` → 86/86. The owner's own pre-session edit of `apps/be/.env.example` (2 → 1, file
  mtime 2026-09-17 17:43 UTC, masked by git's stat cache until the stash/pop of this session
  surfaced it) is committed separately — 1 IS the shop's buffer (the LAN instance runs 1 and a
  20.000 ₫ late fee). The BR-1 buffer test and the CI env (`CLEANING_BUFFER_DAYS: '2'`) still
  assume 2; not touched here, the owner decides whether the test follows the shop.
- Watch out: a single-day rental born `out` (start = shopToday) now sits on due-out (marked
  done) AND due-back — expected, not a duplicate; the hand-out count in the heading is the
  day's total, not the pending count.
- Next: backlog unchanged (rental `notes` displayed nowhere, no rental detail route,
  `payments/correct-movement` awaiting the owner, release lane r2). The LAN instance
  (`/opt/dress-prod`, master@5a0ea7d) needs a redeploy once this is merged if the shop wants it.

## 2026-09-03 (28) — three owner asks shipped: rental discount, duplicate-dress `_n`, size buttons

- Done: on `feat/spec-drafts-batch-3` (where the last session left HEAD), two `pass` entries,
  committed at session end and merged to master by PR (the owner asked after the manual test):
  1. `rentals/rental-discount` (FR-RENT-11): `rentals.discount_amount` (migration
     1755400000000, DEFAULT 0, CHECK ≥ 0), `RentalProps.discount: Money`, the aggregate refuses
     > Σ item prices (400), `CreateRentalRequestDto.discountAmount?`,
     `RentalListItemDto.discountAmount`. FE: discount field on the new-rental form (grouped
     read-back; subtotal / discount / payable in the picker; above-subtotal refused client-side),
     collect form suggests Σ agreed − discount and says so in its hint.
  2. `catalog/duplicate-dress` (FR-CAT-08): `POST /dresses/:id/duplicate` → `<base>_<n>` from 1 (owner corrected 0 → 1 during manual test),
     max + 1, copy-of-copy numbers from the ORIGINAL, race = UNIQUE + recount ×3, the copy gets
     its own price-history v1. Codes now allow `_`. FE: `Nhân bản` on the detail page AND on every catalog row → size
     dialog → lands on the copy. Size everywhere = `SizeOptionGroup` buttons XS/S/M/L/XL (a legacy
     value shows as a sixth pressed button); the API keeps `sizeLabel` free text.
- Numbers: be 168 unit (+20) · 86 e2e (+10, two new suites) on real Postgres · fe 103 vitest (+7)
  · qr-admin tsc green · both builds green · lint green · fe arch (d) + `contract:check` were red only
  while the regenerated client sat uncommitted — green once committed together with the BE, as done.
- Watch out: commit BE + `packages/contract` + BOTH generated clients + FE together (the contract
  never alone). The new migration was applied to `dress_rental_test` by the e2e global-setup AND
  to the dev DB (`pnpm --filter be migrate`) this session.
- Watch out: smoke.sh has no discount/duplicate steps (deliberate — e2e is the gate); the
  Playwright happy path never typed a size, so it is unaffected.
- Watch out: any trailing `_<digits>` on a code is read as a copy number (`VD_012` = copy #12 of
  `VD`) — accepted because no code carried `_` before this feature; do not "fix" it without an FR.
- Watch out (tooling): the Bash tool collapses `\` in perl one-liners — two `\d` silently became
  `d` and a test still passed by accident (the first copy carried the same number either way). Fixed with `[0-9]`;
  write regexes through the Write tool or use character classes when a shell is in the way.
- Next: backlog unchanged (rental `notes` displayed nowhere, no rental detail route,
  `payments/correct-movement` awaiting the owner, release lane r2).

## 2026-08-10..11 (27) — the whole batch shipped: five features, five commits, all gates green

- Done: the owner answered "tôi đồng ý" to every §6 recommendation, all five specs flipped to
  `approved`, and the batch was implemented in the recommended order on
  `feat/spec-drafts-batch-3` — one commit per feature, each with spec §7 re-synced as-built,
  ADR 0001 §3/§4 + SRS + aggregate docs updated, and BE unit + real-Postgres e2e + FE vitest run
  before committing. Ledger is 25/25 `pass`.
  1. `identity/manage-users` (`4acfee7`, **breaking /auth/login**): username replaces email
     (seed owner = `owner`/`SEED_OWNER_USERNAME`), accounts lock/unlock (never delete),
     owner-set reset-password, one `user:manage` permission. Everything that signs in changed in
     the same commit: seed, smoke.sh, Playwright, e2e harness, MSW, CI env, both login forms.
  2. `rentals/pickup-before-return` (`0f5f88c`, FR-RENT-10): return only from `out`; a rental
     whose start ≤ shopToday is BORN `out` (both events, one transaction); cancel opens to
     `out` but EVERY cancel passes an empty-ledger guard under the rental row lock
     (`saveCancelled`, take-turns with record-collection) → `rejected_cancel_has_payments`.
     smoke.sh was REWRITTEN to relative dates (anchor D0=today+3 — the fixed 2026-08 fixtures
     had rotted, and pre-ADR-0001 409 expects became 422s); the Playwright happy path now books
     TOMORROW and steps the board +1 day, the only flow that still browser-proves the pickup tap.
  3. `catalog/dress-category` (`5fcbb5f`, FR-CAT-07): second aggregate root, UNIQUE lower(name)
     under race + raw SQL, FK RESTRICT delete with `rejected_category_in_use` + dressCount,
     ?categoryId= filter, CSV auto-create; staff manage, owner deletes.
  4. `catalog/purchase-price` (`8b23f57`, FR-CAT-05): the repo's FIRST field-level authorization
     — staff requests CARRYING the field get a named 403; responses omit the KEY for staff
     (queries carry `readerRole`). Depcruise caught the real lesson: `CurrentSubject` must come
     from `libs/authz`, not identity/guards.
  5. `catalog/price-history` (`2345531`, FR-CAT-06): append-only log written in the SAME
     transaction via `insertWithHistory`/`saveWithPriceHistory`; v1 at create + migration
     backfill; atomicity e2e-proven (a refused write leaves no orphan row); changer name via a
     read-side LEFT JOIN (documented deviation from the drafted port — one JOIN ≠ a port).
- Final numbers: be **148 unit** · **76 e2e** on real Postgres (9 suites) · fe **96 vitest** ·
  qr-admin 17 · contract:check + fe/be arch + lint + both builds green ·
  `pnpm --filter fe e2e` **1 passed (18.9s)** against the real stack. Four new migrations
  (username/active, categories, purchase_price, price_history) applied on both dev and test DBs.
- Watch out: the branch now carries the five spec drafts AND the five implementations — merge it
  as ONE PR (or fast-forward), remembering lesson (25): delete the head branch after merge.
- Watch out: smoke.sh is now date-relative and outcome-correct, but it is still a MANUAL runtime
  proof (not in CI/init.sh) — run it against a fresh compose DB when touching rentals flows.
- Watch out: the LATE_FEE_PER_DRESS_PER_DAY=200000 fix in the local `.env` is machine-local;
  a fresh clone copies `.env.example`, which was always correct.
- Next: unchanged backlog — rental `notes` displayed nowhere, no rental detail route,
  `payments/correct-movement` awaiting the owner's ruling; plus release lane r2 (r1 predates
  SIX shipped features now).

## 2026-08-10 (26) — five feature specs drafted from the owner's next batch (no product code)

- Done: the owner's five asks became five design-tier spec DRAFTS through the
  `init-feature-spec` lane, each with its contract check run on the draft shape and the business
  rules held as §6 blocker questions — the lane forbids inventing them. Tracked as five `todo`
  entries in `feature_list.json` (design gate holds them there until approval):
  1. [rentals/pickup-before-return](docs/design/rentals/pickup-before-return.md) — return only
     from `out`; a rental created for today is born delivered. REVERSES the as-built
     booked→returned branch; smoke.sh + Playwright happy path pivot with it, same commit.
  2. [catalog/purchase-price](docs/design/catalog/purchase-price.md) — owner-only field, the
     repo's FIRST field-level authorization (403 outcome on staff write, key OMITTED on staff
     read). Meaningless until manage-users ships — noted as ordering, not dependency.
  3. [catalog/price-history](docs/design/catalog/price-history.md) — append-only
     `dress_price_history`, same-transaction rows, backfill v1 per existing dress.
  4. [catalog/dress-category](docs/design/catalog/dress-category.md) — second aggregate root in
     catalog, UNIQUE lower(name), FK RESTRICT delete with `rejected_category_in_use`.
  5. [identity/manage-users](docs/design/identity/manage-users.md) — owner creates/locks/resets
     staff accounts, login moves to username/password (FIRST breaking change on /auth/login);
     the feature that makes every owner-only rule real.
- Blockers the owner must answer (full tables in each spec §6): backdated creates auto-out?;
  escape hatch for a mis-created born-out rental; board action on a booked-but-due-back card;
  CSV path for 200 purchase prices; purchase price on the list screen?; who reads price
  history; who manages categories; CSV category column with auto-create?; username replaces
  email outright?; display name; second owner; locked-login message; staff self-password.
- Watch out: implementation order suggestion — manage-users EARLY (it gives owner-only meaning
  and every later audit trail a real person), pickup-before-return next (daily-operation rule),
  then category/purchase-price/price-history in any order; category is the smallest.
- Watch out: new outcome codes across specs 1/2/4/5 must land in ADR 0001 §3 in the same PR as
  their implementation; SRS gets FR-RENT-10/FR-CAT-05..07/FR-AUTH-04 only at approval, per the
  settle-late-fee precedent.
- Next: owner answers §6 → flip the chosen spec to `approved` → implement one feature per
  branch/PR with the stacked-merge lesson from (25) in mind.

## 2026-08-10 (25) — master restored: the stacked work actually lands (repair session)

- Done: the five stacked PRs had NOT landed on master. Merging #1 first without deleting its head
  branch means GitHub never retargets the rest, so #2–#5 merged into their stacked BASE branches
  instead: 27 commits (outcome-model 8, e2e-ci 2, ui-review-batch 8, payments-record-collection 9)
  sat stranded in merge commits on the feature branches while master carried only the QR phase.
  PR #6 (`develop`) contributed nothing: `bdd211d` is the pre-rebase copy of `51040dc` (identical
  patch-id) left over on old local master. PRs #7–#8 were symptom patches on the incomplete
  master — #7 re-added the `@types/qrcode` the stranded `a26e21f` already carried.
- Fix: merged `b498a37` (the stack tip) into master; README conflict resolved to the stack side;
  the auto-merge silently DROPPED `@types/qrcode` from `apps/be/package.json` (bdd211d's stale
  deletion beat the stack's re-add — exactly the session-19 watch-out) — restored, so master's
  tree is byte-identical to the verified stack tip. Then merged origin/master (#7–#8) on top —
  clean; the lockfile was already identical on all three sides. Pushed as `3d96f1d`.
- Verification: CI on master fully green — scope, contract, be, fe, qr-admin, and **e2e's first
  ever GitHub run** (the AC2 gap session 21 left open is now closed).
- Watch out: merging a stacked chain top-down requires deleting each head branch right after its
  PR merges, or GitHub keeps the next PR pointed at the already-merged base branch.
- Watch out: the `e2e` job has no `needs: scope` guard — it runs on every PR. Safe but unscoped;
  `.github/scripts/ci-scope.sh` predates the job and emits no `e2e` output.
- Next: unchanged from (24) — rental `notes` are displayed nowhere, there is still no rental
  detail route, and `payments/correct-movement` awaits the owner's ruling.

## 2026-08-10 (24) — everything pushed as 5 stacked PRs, each reviewed by codex until clean

- Done: the 18 commits that had never left this machine are now **five stacked PRs** on
  `bangnk2000/dress-rental`, one per feature session, each reviewed by the **codex CLI in WSL**
  (`codex exec review --base <parent>`) and fixed until the review came back with nothing. Every
  branch is pushed; nothing is merged — that is the owner's call.

  | PR | Branch | Base | codex findings fixed |
  | --- | --- | --- | --- |
  | [#1](https://github.com/bangnk2000/dress-rental/pull/1) | `feat/qr-url-phase` | `master` | 5 |
  | [#2](https://github.com/bangnk2000/dress-rental/pull/2) | `feat/outcome-model-and-invariant-proof` | #1 | 2 |
  | [#3](https://github.com/bangnk2000/dress-rental/pull/3) | `feat/e2e-ci-and-release-record` | #2 | 0 |
  | [#4](https://github.com/bangnk2000/dress-rental/pull/4) | `feat/ui-review-batch` | #3 | 4 |
  | [#5](https://github.com/bangnk2000/dress-rental/pull/5) | `feat/payments-record-collection` | #4 | 9 |

- **The review paid for itself in the money paths.** What it found, in the order it matters:
  - `payments/record-collection` checked the rental status in the service, then inserted in a
    separate transaction — a concurrent return could close the rental in between and the money
    landed on a closed rental anyway. The check now runs `SELECT … FOR UPDATE` inside the write.
  - The return dialog treated a **failed** ledger read, and later a ledger **still loading**, as
    "no deposit collected", so it offered a refund based on the catalog for money the shop may
    never have taken. An unknown basis now blocks and says why.
  - Even with a re-read at submit time, a collection could still commit between that read and the
    write. The settlement now sends the basis it used and the return write verifies it under the
    rental's row lock (`rejected_deposit_basis_changed`), which is the only place that cannot be
    raced past. The two operations lock the same row, so they take turns.
  - Same class in `catalog`: a duplicate code caught by the UNIQUE index surfaced as a 409
    envelope while the identical pre-check answered a 422 outcome — the form lost its field error
    depending on who won the race. ADR 0001 now states the rule for every precondition with a
    constraint behind it, and each such rule owes a concurrent `test:e2e` case.
  - `apps/qr-admin` stored a refresh token and never used it: every reload signed the owner out.
    Fixing that created the need for a sign-out, which did not exist either (a staff member was
    stuck on the denied screen forever).
  - The rest: a booking rejection outliving the booking it described, a QR preview downloadable
    under the next row's filename, the QR history omitting the creator FR-QR-03 requires, and a
    `0` typed into a collect field 400-ing the whole request.
- Verification at the stack tip: `bash init.sh` fully green — be **114 unit** · **46 e2e** ·
  fe **83** · qr-admin **17** · contract:check, check, lint, arch, both builds — plus
  `pnpm --filter fe e2e` green against the real stack.
- **Watch out — the stack is stacked.** Each PR's base is the previous branch, so merge in order
  #1 → #5 (GitHub retargets the next one automatically). Reviewing #5 alone shows only its own
  diff, which is the point.
- **Watch out — local `master` is stale**: it sits at `bdd211d`, five commits ahead of
  `origin/master`, and those commits are the QR phase now under review in PR #1. Do not push it;
  let the PRs land and reset it to `origin/master` afterwards.
- Watch out: `codex exec review --base X` resolves X LOCALLY. Reviewing PR #1 against `master`
  silently produced an empty diff (local master already contained those commits) — use
  `origin/master`. The default model also needs codex ≥ 0.147; the copy at
  `~/.local/share/pnpm/bin/codex` is current, and an older 0.139 shim shadows it earlier in PATH.
- Next: unchanged from below — rental `notes` are displayed nowhere, there is still no rental
  detail route, and `payments/correct-movement` (fixing a wrongly recorded amount) is the open
  operational hole the owner has to rule on.

## 2026-08-10 (23) — `payments/record-collection` = pass (the deposit gap is closed)

- Done: the gap three features and the readiness pass all pointed at — **money coming IN was never
  recorded** — is closed as one design-tier feature through the spec-before-code lane. Ledger is
  25/25 `pass`.
- The lane worked as designed: [record-collection.md](docs/design/payments/record-collection.md) was
  written FIRST with the business rules as **blocker questions**, and the shop owner answered four
  (§6): (1) a **standalone action, usable any time** — not folded into create or pickup, because
  some customers transfer the deposit days early; (2) amounts **pre-filled** (Σ catalog deposit,
  Σ agreed price) but **editable**, and the ledger records what was actually TAKEN; (3) **fees are
  deducted from the deposit** — this closes the open question `rentals/settlement-clarity` left
  behind, and it upgrades a guess into an approved rule; (4) **rental fee is in scope** with the
  deposit, so cash reconciliation has both halves.
- BE: `payments` grew its **first aggregate + command** — exactly the trigger its own design doc
  predicted. `POST /rentals/:rentalId/payments/collect` writes 1..2 rows in one transaction;
  `payment:collect` is open to staff on purpose (the person holding the cash is at the counter,
  unlike the owner-only late-fee waiver).
- The rule with teeth is **BR-7: one deposit and one rental fee per rental**, enforced by two
  partial UNIQUE indexes, not by app code. `payments-collection.e2e-spec.ts` provokes it three ways:
  a second call, TWO CONCURRENT calls that both read an empty ledger ([200, 422], exactly one row),
  and a raw INSERT that bypasses the app. The race is translated to `CollectionConflictError` at the
  adapter edge and answered with the SAME outcome as the pre-check — the create-rental pattern.
- Read side: `GET /rentals/:id/payments` now carries `summary` (per-kind totals, computed in the
  projection), and `RentalDressDto` gained `agreedPrice` from `rental_items.price`. FE: the payments
  dialog became THE money screen of a rental (ledger + totals + collect form), reachable from every
  row — the button is `Tiền` now, since "Thanh toán" on a rental booked five minutes ago read wrong.
- **Watch out — the browser caught what no unit test could:** the return dialog did not invalidate
  the rental's payments query, so after settling, the money screen showed a pre-settlement ledger for
  the full 60s `staleTime`. The repo's invalidate rule now has a third vee: *a mutation that moves
  money also invalidates that rental's payments key* (recorded in `apps/fe/AGENTS.md` §Screen rules).
- **Watch out — the migration is the first one that is genuinely reversible**: `down` is DROP INDEX,
  no data lost, unlike 0001–0003 whose down is DROP TABLE. Release risk #3 stays true for the others.
- Verification: be **109 unit** (+14) · **42 e2e** (+12) · fe **71** vitest (+5) · qr-admin 13 ·
  `contract:check` / `check` / `lint` / `arch` / both builds green · `pnpm --filter fe e2e`
  **1 passed (15.6s)** against the real stack — the happy path now records 2.000.000₫ of deposit
  against a 3.000.000₫ standard and proves the refund follows the money, not the catalog.
- Deliberately left open (in the spec §6 and payments-aggregate.md, both need an owner decision):
  **correcting a wrongly recorded amount** (append-only + `amount ≥ 0` means no compensating row is
  possible — a real operational hole once the shop is live), and **collecting a deposit in
  instalments** (BR-7 forbids it today).
- Next, in the order I would take them: (1) rental `notes` are captured at booking and displayed
  nowhere; (2) no rental detail route — it is the natural home for notes, the ledger, and a money
  button reachable from the board (the board cannot open today's dialog: `features/today` importing
  `features/rentals` would break the no-cross-feature rule); (3) `payments/correct-movement` if the
  owner wants it before go-live; (4) the remaining P2/P3 UI items (overdue card showing days late,
  one search model instead of two, `EmptyState` heading level, language switcher out of the primary
  header, shorter Vietnamese date format, offline indicator); (5) the release lane still stops at
  go/no-go with P1–P7 missing, and r1 now lists FIVE features it does not cover.

## 2026-08-10 (22) — UI/UX review of `apps/fe`, then its top four findings shipped

- Done: read the whole FE (~4.9k lines of TSX) and wrote up 22 improvement points, then implemented
  the four highest-value groups as four tracked features. Ledger is 24/24 `pass`.
- `rentals/settlement-clarity` (`8283e11`, cross-contract): the only screen that moves cash asked
  staff to type a seven-digit refund from memory — no separators, no sum, no statement of what was
  taken. `RentalDressDto` gained `depositAmount` through the existing `DressLookupPort`; the dialog
  pre-fills the refund with `deposit − suggested late fee`, states the arithmetic live, flags a
  refund that disagrees with it, and reads every amount field back grouped via `FormDescription`
  (already wired to `aria-describedby`). **Watch out:** pre-filling `deposit − fees` encodes a
  deduction convention taken from `smoke.sh` and the Playwright happy path, NOT an owner decision
  like the late-fee rules — recorded as an open question in
  [payments-aggregate.md](docs/design/payments-aggregate.md) and in the commit.
- `rentals/dress-availability-in-picker` (`03bf04e`, FE-only): every chosen dress now checks itself
  against the form's dates (`Còn trống` / `Vướng lịch` + the `blockedUntilDate` the staff cannot
  deduce), and a rejection marks exactly the dresses the server named — `dressIds` was designed for
  this in ADR 0001 and the form was throwing it away. Search results are deliberately NOT checked
  (a query per keystroke per row). The flag clears when the dates or the selection change.
- `catalog/dress-thumbnails` (`13273d1`, FE-only): photos existed since `catalog/manage-dress` and
  showed up only on the detail page — not on the two screens where dresses are CHOSEN. New kernel
  `PhotoThumbnail` (decorative `alt=""`, dead links degrade to a placeholder) in the catalog table
  and both picker lists.
- `fe:board-and-confirm-ergonomics` (`1eaba2f`, FE-only): day stepping inside `useTransition` (the
  board no longer blanks), ± day + `Hôm nay`, 44px board actions, per-row spinner gated on
  `mutation.variables` instead of `isPending`, customer in the accessible name, and `window.confirm`
  replaced by `ui/alert-dialog` + `ConfirmDialog` for both irreversible actions. The dismiss button
  says `Quay lại`: on the rentals list the confirmed action is itself a cancel.
- Verification: fe **66** tests (+9 net, 3 rewritten to drive the real dialog), be **95** unit + 30
  e2e, qr-admin 13, root `contract:check` / `check` / `lint` / `arch` / both builds green, and
  `pnpm --filter fe e2e` green against the real stack (1 passed, 15.9s) — the happy path exercises
  both resized board buttons and the new pre-filled refund.
- Watch out: adding an `aria-label` changes the accessible NAME, so vitest queries for those buttons
  had to move to regex — the visible label is still a prefix of the name (WCAG 2.5.3). And the
  `Hôm nay` test asserts the date INPUT, not the last request: that board is already cached, so
  returning costs no round trip.
- Watch out: `docs/releases/2026-08-10-r1/` was written BEFORE these four features. Its README now
  lists them as explicitly not covered — before go/no-go, either ship r1 at the SHA the readiness
  pass examined, or write the four missing readiness files (the first one carries a contract change).
- Next, from the same review, in the order I would take them: (1) the deposit COLLECTION is still
  never recorded — three features and the readiness pass all point at it, and it is what stops the
  shop reconciling cash; (2) rental `notes` are captured at booking and displayed nowhere; (3) no
  rental detail route at all; (4) the remaining P2/P3 items (overdue card showing days late, one
  search model instead of two, `EmptyState` heading level, language switcher out of the primary
  header, `dateStyle: 'medium'` → a shorter Vietnamese format, offline indicator).

## 2026-08-10 (21) — `infra/e2e-ci` = pass + the first release record (`docs/releases/2026-08-10-r1/`)

- Done (`infra/e2e-ci`): the browser proof is no longer manual. `apps/fe/playwright.config.ts` now
  declares two `webServer`s — `pnpm --filter be build && start` on :3000 (readiness probed via
  `/api/v1/dresses` answering 401, since there is no health route) and
  `pnpm build && vite preview --port 4173 --strictPort` — so `pnpm --filter fe e2e` starts the stack
  it needs and is the SAME command locally and in CI. Two deliberate boundaries: the DATABASE is
  never started by the tests (migrate + seed stay an explicit act), and `E2E_BASE_URL` means "I run
  the servers myself" (`webServer` becomes `undefined`, nothing is started). The browser now
  exercises the PRODUCTION build, service worker included — `vite.config.ts` gained the matching
  `preview.proxy` for `/api`, which is also what production needs from Nginx (NFR-03).
- Done (CI): new `e2e` job — own postgres service, `playwright install --with-deps chromium`,
  `pnpm --filter be migrate`, `pnpm --filter be seed` (`SEED_OWNER_PASSWORD=changeme`, the pair the
  spec signs in with), `pnpm --filter fe e2e`, and report + trace uploaded on failure. An `html`
  reporter was added so there is something to upload besides the raw trace.
- Verification: cold run against only `docker compose up -d` + migrate + seed = **1 passed (18.2s)**;
  again with `CI=1` (reuseExistingServer off) = **1 passed (17.1s)**. `E2E_BASE_URL` pointed at a
  dead port emitted **0 `[WebServer]` lines** and failed in seconds — proving nothing is started —
  and produced BOTH `playwright-report/` and `test-results/<test>/trace.zip`, the two paths the job
  uploads. Root gates green: contract emit + `generate:api` clean, check, lint, arch, be 95 unit +
  30 e2e, fe 57, qr-admin 13, both builds. **AC2 is the one gap: the job has never run on GitHub —
  push the branch and read the run.**
- Done (release lane, first use): `docs/releases/2026-08-10-r1/` — 20 per-feature readiness files,
  `release-plan.md` (§0 release-wide rows + risks R1–R4, §1 prerequisites P1–P7, §2 ordered steps,
  §3 compatibility matrix), `rollback.md`, a seeded `record.md`, plus a local index README. Owner
  decisions taken as input: all 20 features are the candidates, target is VPS + PM2 + Nginx, bangnk
  is owner AND on-call. The lane prepares only — it ends at "STOP — awaiting go/no-go".
- What the readiness pass actually found (the useful output, not the paperwork):
  1. **No deployment artifact exists in the repo at all** — no PM2 definition, Nginx conf, TLS,
     backup procedure, production secrets or catalog CSV (P1–P7). Every deploy step names a command
     whose artifact still has to be created.
  2. **NFR-03 is load-bearing, not a preference**: `configureApp()` never calls `enableCors()`, so
     unless Nginx serves the SPAs and proxies `/api` on ONE origin, every call fails. `apps/qr-admin`
     additionally sets no `base`, so a subpath deploy breaks its assets — it needs its own host.
  3. **Every migration `down` is a `DROP`** (tables, or `photo_urls`). Schema reversal is safe
     exactly once — before the shop enters data. After that the only reversal is restore-from-backup,
     and the backup does not exist. This is why P5 blocks.
  4. **R1–R4 are `missing` on every feature**: no observability of any kind, no feature flag, one
     person as owner+on-call, no cross-version contract test.
  5. Two features are thinner than a uniform `pass` suggests: `qr/create-url-code` has no live-DB and
     no browser proof (the ledger says so), and `qr/styled-svg-rendering` has never been printed and
     scanned. Both recorded in their own readiness files.
- Watch out: `bash init.sh` still aborts in this environment on `pnpm install --frozen-lockfile`
  (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`) — the gates were run individually with
  `npm_config_verify_deps_before_run=false`. Nothing is committed yet: the working tree carries this
  session's changes.
- Next: (1) push the branch so the CI `e2e` job proves itself — that is the cheapest open item in the
  release; (2) the release's own prerequisites P1–P7 are real work and the natural next feature
  (`infra/deploy-vps` would give PM2 + Nginx + backup an entry in the ledger instead of living only
  in the plan); (3) still open from before: the `qr` context has no invariant proof, and the deposit
  COLLECTION is never recorded — the readiness pass surfaced that second one from three different
  features, which is a strong signal.

## 2026-08-10 (20) — `rentals/settle-late-fee` = pass (first capability through the spec-before-code lane)

- Done (the point of the exercise): the `init-feature-spec` lane was used for real. The spec
  ([docs/design/rentals/settle-late-fee.md](docs/design/rentals/settle-late-fee.md)) was written
  FIRST at status `draft` with the fee formula and waiver authority left as **blocker questions** —
  the lane forbids inventing business rules — and the contract check on the draft shape found 2
  blockers, 2 major, 2 minor. The shop owner answered (§6): **200.000₫/ngày/váy flat**, no grace, no
  cap; the **cleaning buffer does not count as late**; **only the owner may charge less, and must
  give a reason**; the meaning change of `lateFee` is accepted in place. Then, and only then, code.
- Done (BE): the rule is a pure value object (`domain/late-fee.value-object.ts`) reached through
  `RentalEntity.lateFeeQuote()`; the read side (`GET /rentals/:id/late-fee`) calls the SAME domain
  method rather than growing a second copy in SQL. `shopToday()` (`Asia/Ho_Chi_Minh`) is the
  reference day — money must not depend on the VPS clock, which is why the fee does NOT take the
  device date the way the today board does. Waiver rules land in `return-rental.service.ts` AFTER
  the state machine decides, so an already-returned rental still answers
  `rejected_return_not_allowed` rather than a fee complaint.
- Done (contract + FE): the repo's **first 403 outcome** — `{ status: 'forbidden', reason:
  'late_fee_waiver_requires_owner', suggestedLateFee, submittedLateFee }` — plus
  `rejected_waiver_note_required` (422), both added to [ADR 0001](docs/adr/0001-outcome-model-at-the-http-boundary.md)
  §3–§4 before implementation. The return dialog reads the quote, states it in an `aria-live`
  banner, pre-fills the field, disables submit until the number is known, and keeps both waiver
  rejections in place instead of closing.
- Verification: be **95 unit + 30 e2e** (8 new in `test/late-fee.e2e-spec.ts` proving the 403 leaves
  the rental `out` with no payments row), fe **57** (4 new dialog states), qr-admin 13, root
  check/lint/arch/builds green, Playwright happy path still green against the real stack.
- Side fix (found by the first failing test, worth knowing): `lib/format.ts` read the i18n
  singleton, so under test money formatted `₫1,200,000` (en) while every label was Vietnamese. It
  now reads `<html lang>` — one source for text and numbers. No test had asserted formatted currency
  before, which is why it hid for so long.
- Next: the ledger is 19/19 `pass` again. Strongest candidates — (1) a first release record through
  `docs/spec/init-release/` into `docs/releases/<id>/` (the VPS/PM2 deploy is manual today, so the
  readiness checklist + rollback plan is the missing half); (2) CI job for Playwright so the browser
  proof stops being manual; (3) `qr` context still has no invariant proof spec.

## 2026-08-09 (19) — `infra/outcome-model` + `infra/invariant-proof-e2e` = pass (both MUST gaps closed)

- Done (design gate first, per the process): [ADR 0001](docs/adr/0001-outcome-model-at-the-http-boundary.md)
  approved before any code — decision, full outcome catalog (§3), UI state matrix (§4), rejected
  alternatives. `docs/SRS-dress-rental.md` (FR-AUTH-02, FR-RENT-02, BR-1) and the rentals / catalog /
  identity / qr-admin design docs were re-synced in the SAME change, and `docs/design/README.md`
  gained **B2.1** (outcome catalog before code, `useCaseSpec` + `outcomes` inputs, spec-file/ADR
  conventions) plus an ADR index.
- Done (`infra/outcome-model`): ONE wire rule — returned `Result` Err → outcome body
  `{ status, ...payload }` at 422/403; thrown → `{ error: { code, message, details?, correlationId } }`.
  `libs/exceptions` gained `BusinessOutcomeException`, `ErrorDetail`, `ApiErrorResponseDto`; the
  global filter renders exactly those two shapes and hides internals on 500. Nine command
  controllers map each domain error to its own snake_case code with a typed payload
  (`dressIds` / `currentStatus` / `dressCode`) and declare `@ApiResponse({ status: 422, type })`.
  The EXCLUDE race is translated in `rental.repository` → `RentalItemsOverlapError` and converted in
  `create-rental.service` back to the SAME `rejected_dress_unavailable` (re-queried ids), so one
  business rule has one code. Login/refresh reject as outcomes, so **401 now means only "the guard
  rejected the access token"**. FE: `src/api/errors.ts` is the single `mapApiError` seam, the three
  `features/*/lib/is-conflict-error.ts` files are deleted, every code has a designed state + vi/en
  key; `apps/qr-admin/src/api/errors.ts` is the same seam (`error-message.ts` gone).
- Done (`infra/invariant-proof-e2e`): `apps/be/test/` — 22 tests on real Postgres via
  `pnpm --filter be test:e2e`, covering the overlap pre-check, the cleaning buffer, a concurrent
  race ([201, 422] with one row), a raw INSERT that bypasses the app, catalog/staff UNIQUE + status
  CHECKs, and that 404/401 stay fault envelopes. CI has a postgres service; `init.sh` calls the real
  gate; `apps/be` lint now also covers `test/`.
- Done: `apps/qr-admin/AGENTS.md` created (the app-level contract that was missing), with its four
  deliberate deviations (vi-only, no PWA/router, no plop, hand-written error copy).
- Verification: `pnpm --filter be test` 82 · `pnpm --filter be test:e2e` 22 · `pnpm --filter fe test`
  53 · `pnpm --filter qr-admin test` 13 · root `check`, `lint`, `arch` (every rule except the
  freshness item), `pnpm --filter fe build`, `pnpm --filter qr-admin build` all green. `pnpm contract`
  re-run is idempotent (md5 identical).
- Committed on branch `feat/outcome-model-and-invariant-proof` (`761f310` + follow-up), so
  `contract:check`, the arch freshness item and a full `bash init.sh` are **green** — the generated
  layer landed together with the BE change, as the contract invariant requires.
- Playwright DID run against the real stack and passes. Two rough edges were fixed to make it
  runnable as documented: `scripts/seed-owner.cjs` now loads `apps/be/.env` (README step 3 always
  claimed it did, but the script only read `process.env`), and the board locators in
  `e2e/happy-path.spec.ts` are scoped to the run's own rows — the old page-wide lookups broke as soon
  as the target database held any other rental (an overdue leftover produced two return buttons).
  The api must be started from `apps/be` (ConfigModule resolves `.env` from the cwd).
- Watch out: in this environment pnpm 11 wants to purge `node_modules` before every script; the
  workaround is `pnpm --config.verifyDepsBeforeRun=false <script>`. Also `nest build` had been
  relying on an undeclared `@types/qrcode` — now a real devDependency, which a clean
  `--frozen-lockfile` install would otherwise break.
- Next: no tracked backlog. Strongest candidates — (1) a first release record through
  `docs/spec/init-release/` into `docs/releases/<id>/`, since the ledger is all `pass`; (2) an
  `Idempotency-Key` ADR if double-submit needs more than the DB constraint; (3) migrate Deviation #4
  (cross-context table reads) to contract queries if a schema change ever bites.

## 2026-08-09 (18) — spec re-sync + harness docs caught up (no product code)

- Done: `docs/spec/` re-synced from upstream `knowledge-system` commit `815fa0f`. The four existing
  sets are refreshed byte-for-byte and two NEW sets are vendored — `init-feature-spec` (use-case
  spec + outcome catalog + UI state matrix, approved before code) and `init-release` (readiness,
  release/rollback plan, compatibility matrix → `docs/releases/<release-id>/`). New
  `docs/spec/README.md` is the vendor manifest: provenance, what each set owns, the four upstream-only
  `ddd-*` docs that are deliberately NOT vendored, and the exact re-sync recipe including the single
  local delta (8 rewritten links).
- Done: stale harness/init docs updated to the repo as-committed — root `AGENTS.md` (spec entry
  points incl. `apps/qr-admin` → init-react, design gate before `in-progress`, optional `acceptance`
  field, gate list that no longer implies a green `be test:e2e`), `clean-state-checklist.md`
  (both generated clients, design as-built note, "don't patch vendored spec"), `claude-progress.md`
  (backfilled sessions 4–17, which existed only in this handoff), root `README.md` doc index (+ QR
  SRS, + spec index), `init.sh` and `ci.yml` comments (dead "README.md step 2/4" pointers replaced;
  the `test:e2e` no-op is now stated instead of implied).
- Done: the spec change with teeth is the **outcome model** — a business rejection must leave BE as
  an outcome body `{ status: '<snake_case_code>' }` at 422/403 via `BusinessOutcomeException`, faults
  as `{ error: { code, message, details?, correlationId } }`, and FE must read wire shapes in exactly
  one `mapApiError` seam. This repo does neither (409 + flat `GENERIC.CONFLICT`; three feature-local
  `is-conflict-error.ts` + `qr-admin/src/api/error-message.ts` branching on status). Recorded as
  `apps/be/AGENTS.md` GAP #6 and `apps/fe/AGENTS.md` GAP #8, each naming the other.
- Verification: doc-only session, no source or generated artifact touched — `packages/contract/`,
  `apps/fe/src/api/generated/` and `apps/qr-admin/src/api/generated/` are untouched, so no root gate
  outcome can change. `feature_list.json` gained only its `rules` line (acceptance + design gate); no
  entry was added, since nothing shipped. Vendored files verified identical to upstream
  (`diff -rq` per set) except the 8 documented link rewrites.
- Next: unchanged top candidate — spec gap #5: real-Postgres invariant proof for
  `rental_items_no_overlap` (compose/testcontainers) + CI postgres service + the missing
  `pnpm --filter be test:e2e` script. Then the outcome model (BE #6 + FE #8) as ONE cross-contract
  feature: outcome catalog per use case → `BusinessOutcomeException` + envelope + `@ApiResponse` →
  `pnpm contract` → FE `mapApiError` + per-outcome copy. Do not ship half of it.
- Watch out: `docs/spec/` is vendored — never "improve" a file there; fix it upstream in
  `knowledge-system` and re-sync per `docs/spec/README.md`. `apps/qr-admin` still has no app-level
  `AGENTS.md`; until it gets one, `apps/fe/AGENTS.md` ring/contract rules apply to it minus
  i18n/PWA/routing. Creating that file is a small, worthwhile next doc task.

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

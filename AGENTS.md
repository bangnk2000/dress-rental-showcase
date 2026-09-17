# AGENTS.md — dress-rental (root harness brief)

Internal management app for a dress-rental shop (~200 dresses), replacing Google Sheets.
Monorepo per the init-monorepo-contract spec set. Spec entry points — read the README index
first, NEVER bulk-read a spec folder; each README's File Map says which numbered detail file
to open when the task actually needs it:

- `docs/spec/README.md` — vendor manifest: which sets exist, what they own, sync provenance
- `docs/spec/init-monorepo-contract/README.md` — monorepo/contract rules (this repo's shape)
- `docs/spec/init-nestjs-hexagonal/README.md` — authoritative INSIDE `apps/be`
- `docs/spec/init-react/README.md` — authoritative INSIDE `apps/fe` AND `apps/qr-admin`
- `docs/spec/init-harness/README.md` — session lifecycle rules behind this file
- `docs/spec/init-feature-spec/README.md` — spec-before-code lane: use-case spec + outcome
  catalog + UI state matrix for ONE capability; its output feeds both `10-*-scaffold-prompt`
  INPUT CONTRACTs. Required for a capability with business rejections; skip for pure CRUD reads
- `docs/spec/init-release/README.md` — readiness/rollout lane AFTER features reach `pass`
  (outputs → `docs/releases/<release-id>/`); never deploys. First used 2026-08-10 →
  [`docs/releases/2026-08-10-r1/`](docs/releases/2026-08-10-r1/README.md)

Product intent docs (this product, not the reusable spec):

- `docs/SRS-dress-rental.md` — requirements: FR/BR/NFR ids + the FR ↔ feature traceability table
- `docs/SRS-qr-url.md` — requirements for the QR URL phase (FR-QR-*)
- `docs/design/README.md` — tactical design per context (invariant-enforcement tables) + the
  SRS → design → feature → task process; new features derive from an FR-id, per its §Quy trình

This file is the ONE harness in this repo — never create harness artifacts
(`feature_list.json`, `init.sh`, handoff, checklist) under `apps/*`. An app-level **architecture
contract** is a different thing and each app may have one: `apps/be/AGENTS.md`,
`apps/fe/AGENTS.md` (`apps/qr-admin` has none yet).

## Current state (re-sync at every session end — see Session rules)

**As of 2026-09-18 · `feature_list.json` is 32/32 `pass`, no tracked backlog, no shell routes.**
This section stays a MAP, not a description — each row's detail lives in the doc it points at.

| Area | State | Detail lives in |
| --- | --- | --- |
| `apps/be` | 5 contexts: identity (JWT + ABAC), catalog (incl. duplicate-dress `<code>_<n>` numbering), rentals (Core; rental-level discount), payments (read slice + its own aggregate/command for money collected), qr (owner-only). Offline `openapi:emit`. | `apps/be/AGENTS.md` + `docs/design/<ctx>-aggregate.md` |
| `apps/fe` | Staff SPA: today board (actionable, device-local date, day-stepping in a transition; a rental handed out during the day stays on the hand-out list, marked done), dresses + detail with photos (size = XS…XL buttons; `Nhân bản` duplicates as `<code>_<n>`), new-rental form that checks each chosen dress against the dates and takes a rental-level discount, `/rentals` list with cancel + a money dialog on EVERY row (ledger, totals, and the collect form while the rental is open). Rentals mutations MUST invalidate the board AND list parameterless keys (staleTime 60s) — and any mutation that moves money also the rental's payments key. | `apps/fe/AGENTS.md` (incl. §Screen rules) + `docs/design/` |
| `apps/qr-admin` | Independent Vite/React app for owner QR URLs (own client, own tokens, own gates). | `apps/qr-admin/AGENTS.md` + `docs/design/qr-admin.md` |
| Wire contract | ONE rule: returned `Result` Err → outcome body `{ status, ...payload }` (422/403); thrown → envelope `{ error: { … } }`. **401 = a guard rejected the access token, nothing else.** | [ADR 0001](docs/adr/0001-outcome-model-at-the-http-boundary.md) — catalog §3, UI states §4 |
| Invariant proof | `pnpm --filter be test:e2e` (86 tests) provokes the real EXCLUDE/UNIQUE/CHECK constraints — two concurrent races (booking overlap, double deposit) and raw INSERTs that bypass the app. CI has a postgres service. | `apps/be/test/` + `apps/be/AGENTS.md` §Invariant-proof suite |
| `docs/spec` | Six vendored `init-*` sets, synced 2026-08-09 from upstream `815fa0f`. | `docs/spec/README.md` |
| Open by choice | `Idempotency-Key` unimplemented (DB constraint stops double-submit); cross-context table-read adapters kept. | `apps/fe/AGENTS.md` #8, `apps/be/AGENTS.md` #4 |
| Not in root gates | Playwright (`pnpm --filter fe e2e`, vi happy path) — needs browsers + a live DB, but it is NOT manual any more: it starts the BE and the built FE itself and runs as the CI `e2e` job. | `apps/fe/AGENTS.md` #5, `.github/workflows/ci.yml` |
| Release lane | First release prepared 2026-08-10 (`2026-08-10-r1`, the 20 features that existed at that pass — the four UI features and `payments/record-collection` after it are listed as NOT covered): readiness per feature, plan, rollback, seeded record. **Nothing is deployed** — it stops at go/no-go, and 7 prerequisites (PM2, Nginx same-origin, TLS, backup, secrets, catalog CSV, QR Admin origin) do not exist yet. | [`docs/releases/2026-08-10-r1/README.md`](docs/releases/2026-08-10-r1/README.md) |

Next-session candidates are in `session-handoff.md` (latest entry) — do not re-derive them here.

## Invariants (carry these into every session)

1. **Contract is one-way:** `apps/be` source → `pnpm openapi:emit` → `packages/contract/openapi.json`
   → `pnpm generate:api` → `apps/fe/src/api/generated/` **and** `apps/qr-admin/src/api/generated/`.
   No generated artifact is EVER hand-edited. "FE needs a field" = BE change first, then
   `pnpm contract`.
2. BE: dependencies point inward; SDKs only in adapters (init-nestjs-hexagonal rules).
3. FE: no cross-feature imports; server state only in the TanStack Query cache (init-react rules).
4. Cross-app sharing only through `packages/*` — apps never import each other.
5. FE and BE ship as one unit (same origin in prod;
   `docs/spec/init-monorepo-contract/03-ci-and-runtime.md` §3).
6. Rental domain rule: booking overlap per dress is rejected at the DB level
   (Postgres `daterange` + exclusion constraint), never only in application code.

## Gates (in order — also encoded in `init.sh` and CI)

```
pnpm contract:check         # emit + generate + git diff --exit-code, BOTH clients (drift gates 1+2)
pnpm check                  # be build + fe tsc + qr-admin tsc (drift gate 3)
pnpm lint && pnpm arch      # arch also re-checks generated-client freshness
pnpm test                   # be jest + fe/qr-admin vitest
pnpm --filter be test:e2e   # invariant proof on real Postgres (docker compose up -d first)
pnpm --filter fe build
pnpm --filter qr-admin build
```

Two things to know about these gates:

- `contract:check` and the arch **freshness** item compare the generated layer against HEAD, so they
  are red whenever the contract was regenerated but not yet committed. That is the gate doing its
  job: commit BE + `packages/contract` + both clients together, then they go green.
- `pnpm --filter fe e2e` (Playwright) is deliberately EXCLUDED from root gates and `init.sh` — it
  needs installed browsers plus a migrated + seeded database. It is NOT unproven work, though: CI
  runs it as its own `e2e` job on every push/PR (`infra/e2e-ci`), and the command starts the BE and
  the built FE itself, so locally it is one command against a running compose DB (FE Deviation #5).

## Session rules

- ONE `feature_list.json` entry in progress at a time; evidence before "pass". A
  cross-contract feature is ONE entry carrying BOTH sides' proof
  (`docs/spec/init-monorepo-contract/04-harness-binding.md`).
- Feature ids: `<context>/<use-case>` (BE convention); FE slice `features/<kebab-id>` belongs
  to the same entry. Single-side work: prefix `be:` / `fe:`.
- **Design gate before `in-progress`:** tier the work per `docs/design/README.md` §Quy trình B2.
  Design-tier (new aggregate/invariant/state transition/cross-context contract/new interaction
  pattern) needs its design doc written and approved FIRST — a session that produces only a
  reviewed design doc is a successful session (`docs/spec/init-harness/06-design-first.md`).
  Standard CRUD: the filled scaffold INPUT CONTRACT is the design. Tier inflation — design-shaped
  work labelled standard to dodge the doc — is an audit finding.
- A capability with business rejections gets its outcome catalog from
  `docs/spec/init-feature-spec/` BEFORE the BE slice: the catalog's snake_case codes are what the
  controller renders and what the FE branches on, so both sides scaffold against one list.
- New entries MAY carry `acceptance` (AC ids/text); when present, evidence names which AC each
  command proved (`docs/spec/init-harness/02-artifacts-and-templates.md` §2.2). Existing entries
  were backfilled as-built and legitimately have none — do not invent ACs after the fact.
- Scaffold order for an API-touching feature: BE slice → `pnpm contract` → FE slice. The
  contract step is part of the scaffold, not optional glue.
- End of session: update `feature_list.json` + `session-handoff.md` + `claude-progress.md`;
  design-tier feature → add the dated as-built note to its design doc; **re-sync the Current
  state section of this file to the repo as-committed** (a stale current-state misroutes the
  next session — `docs/spec/init-harness/03-session-loop.md` §3.5); run
  `clean-state-checklist.md`; no unintended diff under `packages/contract`,
  `apps/fe/src/api/generated` or `apps/qr-admin/src/api/generated`.
- `pass` is the ledger's terminal state. Shipping is a separate lane: `docs/spec/init-release/`
  reads this ledger as its evidence source and writes `docs/releases/<release-id>/`.

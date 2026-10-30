# AGENTS.md — dress-rental (root harness brief)

Internal management app for a dress-rental shop (~200 dresses), replacing Google Sheets.
Monorepo per the init-monorepo-contract spec set. Spec entry points — read the README index
first, NEVER bulk-read a spec folder; each README's File Map says which numbered detail file
to open when the task actually needs it:

- `docs/spec/README.md` — vendor manifest: which sets exist, what they own, sync provenance
- `docs/spec/init-monorepo-contract/README.md` — monorepo/contract rules (this repo's shape)
- `docs/spec/init-nestjs-hexagonal/README.md` — authoritative INSIDE `apps/be`
- `docs/spec/init-react/README.md` — authoritative INSIDE `apps/fe` AND `apps/qr-admin`
- `docs/spec/init-nextjs/README.md` — authoritative INSIDE `apps/web` (enter via its §Usage Flow
  1b / `00-system-prompt.md` §Monorepo mode; repo-level deltas: `init-monorepo-contract` 01 §4b)
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
`apps/fe/AGENTS.md`, `apps/qr-admin/AGENTS.md`, `apps/web/AGENTS.md`.

## Current state (a MAP — each row's detail lives in the doc it points at)

- **Ledger:** `node scripts/ledger.mjs summary` (counts, in-progress, latest entries) — never open
  the whole `feature_list.json`; `show <id>` prints one entry. **Owner queue:**
  `node scripts/ledger.mjs pending` — open owner decisions (`ownerPending`) + passed-not-deployed
  entries with their deploy order (`deploy`) — `docs/spec/init-harness/07-human-control.md`.
- **Production (as of 2026-10-31):** API/CMS = `c00f926` (2026-10-28, WSL: PR #30 + #31 on top of release
  [`2026-09-30-r2`](docs/releases/2026-09-30-r2/README.md)), rebuilt unchanged by the first `deploy` run
  2026-10-31 (`7b8d244`, failed at web); web = `dab2db7` (2026-10-29). Nothing on master is undeployed. Redeploys: workflow `deploy` ([`infra/deploy/README.md`](infra/deploy/README.md), not yet run);
  fallback + one-off ops + execution log: out-of-repo `~/deploy-dress/tencent/RUNBOOK.md` §7/§11.
- **Next / watch-outs:** first entry of `session-handoff.md` — do not re-derive them here.

| Area | State (one line; shape, not history) | Detail lives in |
| --- | --- | --- |
| `apps/be` | NestJS hexagonal, 5 contexts: identity, catalog (dresses, photos → R2, public listings + the ONLY anonymous endpoints), rentals (Core), payments, qr. | `apps/be/AGENTS.md`, `docs/design/<ctx>-aggregate.md`, `docs/design/<ctx>/*.md` |
| `apps/fe` | Staff SPA: today board, dresses + photos, rentals (new/list/detail/owner edit, money dialog), `/website` listings. | `apps/fe/AGENTS.md` (incl. §Screen rules), `docs/design/catalog/dress-photo-upload.md` §9 |
| `apps/qr-admin` | Independent Vite/React app for owner QR URLs (own client, tokens, gates). | `apps/qr-admin/AGENTS.md`, `docs/design/qr-admin.md` |
| `apps/web` | Public anonymous Next.js 16 site (:3001, `example.com`): home, `/bo-suu-tap` (+ search), `/bo-suu-tap/[slug]`, `/lien-he`; BE data via its own generated client, ISR. | `apps/web/AGENTS.md`, `docs/design/public-web.md`, `docs/design/web/*.md` |
| Wire contract | Returned `Result` Err → outcome body `{ status, ...payload }` (422/403); thrown → envelope `{ error: { … } }`. **401 = a guard rejected the access token, nothing else.** | [ADR 0001](docs/adr/0001-outcome-model-at-the-http-boundary.md) — catalog §3, UI states §4 |
| Invariant proof | `pnpm --filter be test:e2e` provokes the real EXCLUDE/UNIQUE/CHECK constraints (concurrent races + raw SQL bypasses). CI has a postgres service. | `apps/be/AGENTS.md` §Invariant-proof suite |
| Not in root gates | Playwright: FE (`pnpm --filter fe e2e`, real stack, CI `e2e`); web (`pnpm --filter web e2e`, prod build, Chromium only, CI `web`). | `apps/fe/AGENTS.md` #5, `apps/web/AGENTS.md` #4 |
| Open by choice | `Idempotency-Key` unimplemented (DB constraint stops double-submit); cross-context table-read adapters kept. | `apps/fe/AGENTS.md` #8, `apps/be/AGENTS.md` #4 |
| `docs/spec` | Seven vendored `init-*` sets (version `2026.10.30`) — never edit locally; CI `harness` checks `docs/spec/SHA256SUMS`. | `docs/spec/README.md` (sync provenance) |
| Release lane | `2026-08-10-r1` (stopped at go/no-go), `2026-09-30-r2` (written after rollout; R1–R11 await bangnk; 13 live features un-packed = release debt). | [`docs/releases/2026-09-30-r2/README.md`](docs/releases/2026-09-30-r2/README.md) |

## Which doc to update (keep each fact in ONE place)

| When this changes … | Update | Never |
| --- | --- | --- |
| A ledger entry's status/evidence | `feature_list.json` (edit only that entry; then `node scripts/ledger.mjs check`) | read the whole file |
| Session ends | prepend one `session-handoff.md` entry (rotate per its header) + one `claude-progress.md` line | rewrite old entries |
| A behaviour/rule inside one app | that app's `AGENTS.md` or the feature's `docs/design/` doc (dated as-built note) | copy it into this file |
| Something gets deployed | the **Production** bullet above + the release/runbook record | — |
| An app/context is added or changes shape | its row in the table above | per-feature detail in the row |
| A requirement (FR/BR/NFR) | `docs/SRS-*.md` in the same PR | — |

## Invariants (carry these into every session)

1. **Contract is one-way:** `apps/be` source → `pnpm openapi:emit` → `packages/contract/openapi.json`
   → `pnpm generate:api` → `apps/fe/src/api/generated/`, `apps/qr-admin/src/api/generated/` **and** `apps/web/src/api/generated/`.
   No generated artifact is EVER hand-edited. "FE needs a field" = BE change first, then
   `pnpm contract`.
2. BE: dependencies point inward; SDKs only in adapters (init-nestjs-hexagonal rules).
3. FE: no cross-feature imports; server state only in the TanStack Query cache (init-react rules).
4. Cross-app sharing only through `packages/*` — apps never import each other.
5. FE and BE ship as one unit (same origin in prod;
   `docs/spec/init-monorepo-contract/03-ci-and-runtime.md` §3). `apps/web` is its own Node
   process but stays same-origin for the browser through its `/api/v1` rewrite (01 §4b N5).
6. Rental domain rule: booking overlap per dress is rejected at the DB level
   (Postgres `daterange` + exclusion constraint), never only in application code.

## Gates (in order — also encoded in `init.sh` and CI)

```
pnpm contract:check         # emit + generate + git diff --exit-code, ALL three clients (drift gates 1+2)
pnpm check                  # be build + fe tsc + qr-admin tsc + web typegen+tsc (drift gate 3)
pnpm lint && pnpm arch      # arch also re-checks generated-client freshness
pnpm test                   # be jest + fe/qr-admin/web vitest
pnpm --filter be test:e2e   # invariant proof on real Postgres (docker compose up -d first)
pnpm --filter fe build
pnpm --filter qr-admin build
pnpm --filter web build      # route table = rendering truth
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
  design-tier feature → add the dated as-built note to its design doc; **re-check Current state
  against the repo as-committed** — usually only the Production bullet moves; a table row changes
  only when an area changes shape (`docs/spec/init-harness/03-session-loop.md` §3.5); run
  `clean-state-checklist.md`; no unintended diff under `packages/contract` or any
  `apps/*/src/api/generated`.
- `pass` is the ledger's terminal state. Shipping is a separate lane: `docs/spec/init-release/`
  reads this ledger as its evidence source and writes `docs/releases/<release-id>/`.
- **Owner control** (`docs/spec/init-harness/07-human-control.md`): every rule chosen without the
  owner's decision → an `ownerPending` item on the entry (design doc state `agent-default`), never
  only handoff prose; a pass that ships → `deploy` {order, migration}, and `deployed` once live;
  agent commits carry a `Co-Authored-By:` trailer; PRs fill `.github/pull_request_template.md`.
- New ledger entries carry `tier` (+ `designDoc` for design-tier) and an id matching
  `<context>/<use-case>` or `be:|fe:|web:<slug>` — `ledger.mjs check` enforces both on entries with
  `tier`. Existing entries stay as they are (no backfill, no renames).

# AGENTS.md — dress-rental (root harness brief)

Internal app for a dress-rental shop (~200 dresses, replacing Google Sheets) plus its public site.
This file is the ONE harness — never create harness artifacts (`feature_list.json`, `init.sh`,
handoff, checklist) under `apps/*`; each app has its own **architecture contract** `apps/<app>/AGENTS.md`.

## Start of session (nothing else up front)

1. `node scripts/ledger.mjs brief` — counts, the `in-progress` entry, owner queue, and the newest
   handoff entry (its Next / Watch out are the candidates — never re-derive them). Never open the
   whole `feature_list.json`: `show <id>` = one entry; `pending` = owner decisions + undeployed passes.
2. An entry already `in-progress` IS this session's work — finish it or park it with a handoff note.
3. `bash init.sh` before touching code; red at start = fix the baseline first.
4. Read `apps/<app>/AGENTS.md` for each app you touch, then only what §Route by task names.

## Current state (a MAP — detail lives where each row points)

- **Production (as of 2026-11-07):** API/CMS + web = master `1067bc1` (PR #38, migrations
  1755800000000/1). Undeployed + order: `ledger.mjs pending`. Redeploy: Actions → `deploy`
  ([`infra/deploy/README.md`](infra/deploy/README.md)); fallback/ops log: out-of-repo `~/deploy-dress/tencent/RUNBOOK.md` §7/§11.

| Area | Shape (detail: the app's `AGENTS.md`, `docs/design/`) |
| --- | --- |
| `apps/be` | NestJS hexagonal, 5 contexts: identity, catalog (photos → R2, public listings, the ONLY anonymous endpoints), rentals (Core), payments, qr |
| `apps/fe` | Staff SPA: today board, dresses + photos, rentals, `/website` listings |
| `apps/qr-admin` | Owner QR URL tool; own client, tokens, gates |
| `apps/web` | Public anonymous Next.js 16 site (:3001, `example.com`), ISR, own client |
| Wire contract | Returned `Result` Err → outcome body `{ status, ...payload }` (422/403); thrown → envelope `{ error: { … } }`. **401 = a guard rejected the access token, nothing else.** [ADR 0001](docs/adr/0001-outcome-model-at-the-http-boundary.md) §3 catalog, §4 UI states |
| Open by choice | No `Idempotency-Key` (fe #8); cross-context table-read adapters (be #4) |
| `docs/spec` | Seven vendored `init-*` sets (`2026.10.30`) — never edit; CI checks `SHA256SUMS` |

## Route by task (open only the row you need)

| When the task … | Open |
| --- | --- |
| needs a spec rule | `docs/spec/README.md` → the set's `README.md` → a numbered file only via its File Map. NEVER bulk-read a spec folder |
| is a new need / requirement | `docs/SRS-dress-rental.md` / `docs/SRS-qr-url.md`, then `docs/design/README.md` §Quy trình — every feature derives from an FR-id |
| can reject a request | `docs/spec/init-feature-spec/README.md` + ADR 0001 §3/§4 (skip for pure CRUD reads) |
| is design-tier | `docs/design/<ctx>-aggregate.md`, `docs/design/<ctx>/*.md`, `docs/spec/init-harness/06-design-first.md` |
| picks a rule the owner did not decide | `docs/spec/init-harness/07-human-control.md` |
| prepares a release (after `pass`) | `docs/spec/init-release/README.md` → `docs/releases/<id>/`, never deploys. Latest [`2026-09-30-r2`](docs/releases/2026-09-30-r2/README.md): R1–R11 await bangnk; 13 live features un-packed = release debt |
| ends the session | [`clean-state-checklist.md`](clean-state-checklist.md) (incl. which doc owns each fact) |

## Invariants (carry these into every session)

1. **Contract is one-way:** `apps/be` source → `pnpm openapi:emit` → `packages/contract/openapi.json`
   → `pnpm generate:api` → `apps/{fe,qr-admin,web}/src/api/generated/`. No generated artifact is EVER
   hand-edited. "FE needs a field" = BE change first, then `pnpm contract`.
2. BE: dependencies point inward; SDKs only in adapters (init-nestjs-hexagonal rules).
3. FE: no cross-feature imports; server state only in the TanStack Query cache (init-react rules).
4. Cross-app sharing only through `packages/*` — apps never import each other.
5. FE and BE ship as one unit (same origin in prod; `init-monorepo-contract/03-ci-and-runtime.md` §3).
   `apps/web` is its own Node process but same-origin for the browser via its `/api/v1` rewrite (01 §4b N5).
6. Rental domain rule: booking overlap per dress is rejected at the DB level
   (Postgres `daterange` + exclusion constraint), never only in application code.

## Gates (in order — encoded in `init.sh` and CI)

```
pnpm contract:check         # emit + generate + git diff --exit-code, ALL three clients (drift gates 1+2)
pnpm check                  # be build + fe tsc + qr-admin tsc + web typegen+tsc (drift gate 3)
pnpm lint && pnpm arch      # arch also re-checks generated-client freshness
pnpm test                   # be jest + fe/qr-admin/web vitest
pnpm --filter be test:e2e   # invariant proof on real Postgres (docker compose up -d first)
pnpm --filter fe build && pnpm --filter qr-admin build && pnpm --filter web build  # web route table = rendering truth
```

- `contract:check` + arch freshness compare against HEAD: red while a regenerated contract is
  uncommitted (the gate working) — commit BE + `packages/contract` + all clients together.
- Playwright is outside root gates and `init.sh`, not unproven: CI jobs `e2e` (fe, `apps/fe/e2e/README.md`) and `web`.

## Session rules

- ONE entry `in-progress` at a time; evidence before `pass`. A cross-contract feature is ONE entry
  carrying BOTH sides' proof (`init-monorepo-contract/04-harness-binding.md`).
- Ids `<context>/<use-case>` (its FE slice `features/<kebab-id>` is the same entry) or `be:|fe:|web:<slug>`.
  New entries carry `tier` (+ `designDoc` if design-tier), enforced by `ledger.mjs check`; old entries: no backfill, no renames.
- **Design gate before `in-progress`** (tier per `docs/design/README.md` §B2): design-tier (new
  aggregate/invariant/state transition/cross-context contract/interaction pattern) needs its design doc
  approved FIRST — a session producing only a reviewed design doc is a success. Standard CRUD: the
  filled scaffold INPUT CONTRACT is the design. Tier inflation is an audit finding.
- Business rejections → outcome catalog BEFORE the BE slice; its snake_case codes are what the
  controller renders and the FE branches on.
- `acceptance` is optional; when present, evidence names the AC each command proved. Never invent ACs for old entries.
- API-touching order: BE slice → `pnpm contract` → FE slice (the contract step is part of the scaffold).
- **Owner control:** a rule chosen without the owner → `ownerPending` item on the entry (design doc
  `agent-default`), never only handoff prose; a shipping pass → `deploy` {order, migration}, `deployed`
  once live; agent commits carry `Co-Authored-By:`; PRs fill `.github/pull_request_template.md`.
- `pass` is terminal; shipping is the release lane.
- **End of session:** [`clean-state-checklist.md`](clean-state-checklist.md) — ledger, handoff,
  progress, as-built note, Current state re-check, no generated diff.

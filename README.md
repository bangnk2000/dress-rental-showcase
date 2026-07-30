# dress-rental

Internal management app for a dress-rental shop (**~200 dresses**), replacing the current
Google Sheets workflow. Staff-facing, Vietnamese-first. MVP scope (see `feature_list.json`):
dress catalog, rentals with per-dress booking calendar + cleaning buffer (overlaps rejected at
the DB level), deposits/fees, and a "today" board (due out / due back). The public marketing
site is a separate concern (WordPress/Haravan) — NOT this repo.

**Architecture:** pnpm monorepo per [docs/spec/init-monorepo-contract/](docs/spec/init-monorepo-contract/README.md)
— NestJS hexagonal backend (`apps/be`), React SPA (`apps/fe`), one generated OpenAPI contract
in `packages/contract/` with CI drift gates. Agents: read [AGENTS.md](AGENTS.md) first.

```
apps/be source ──pnpm openapi:emit──▶ packages/contract/openapi.json ──pnpm generate:api──▶ apps/fe/src/api/generated/
```

## Status

**Steps 1–5 running** — both apps live, and the first cross-contract feature
`rentals/create-rental` shipped through the full rhythm (BE slice → `pnpm contract` → FE slice,
one `feature_list.json` entry): bookings block the rental period + cleaning buffer, overlaps
rejected by the Postgres EXCLUDE constraint. Next feature: `rentals/availability-check` or the
`catalog/list-dresses` CSV seed import.
Dev DB: `docker compose up -d` · seed: `pnpm --filter be migrate && pnpm --filter be seed`.

## Bootstrap order (do not reorder — FE needs the real contract)

### 1. Skeleton — DONE

### 2. Backend — DONE (see `apps/be/AGENTS.md`). Original kickoff prompt kept for reference:

```text
You are bootstrapping the BACKEND of this monorepo, inside apps/be/ only.
Specs, in precedence order:
- docs/spec/init-monorepo-contract/ — monorepo rules; its 01 §4 deltas WIN over stack defaults.
- docs/spec/init-nestjs-hexagonal/ — your architecture spec; adopt its 00-system-prompt.md.

1. Product idea: internal management app for a dress-rental shop (~200 dresses), replacing
   Google Sheets. Bounded contexts: catalog (dresses), rentals (bookings/returns/today board),
   payments (deposits, late/damage fees). Persistence: Postgres. Transports: http only.
   AI features: none. Domain rule: per-dress booking overlap (rental range + cleaning buffer)
   must be rejected by a Postgres daterange EXCLUSION CONSTRAINT, not only in code.
2. Package name MUST be "be". Add scripts/emit-openapi.ts + the "openapi:emit" script per
   docs/spec/init-monorepo-contract/02-contract-pipeline.md §2, and the spec-discipline rules
   from its §3 (swagger CLI plugin, @ApiOkResponse everywhere, @ApiTags per context,
   pinned operationIdFactory).
3. HARNESS ALREADY EXISTS at repo root (AGENTS.md, feature_list.json, init.sh) — do NOT create
   harness files under apps/be; update the root ones (infra/be-bootstrap entry) instead.
4. Infer missing details, state assumptions, ask AT MOST 1–2 questions.
5. Output the 9-section scaffold from 00-system-prompt.md and STOP for my approval.
```

Gate: `pnpm openapi:emit` writes `packages/contract/openapi.json` with tags
`catalog`/`rentals`/`payments`, offline (no DB running — 02 §2's offline-boot rule).

### 3. Contract: `pnpm contract` at root (after FE exists this regenerates both stages; right
after step 2 run just `pnpm openapi:emit`).

### 4. Frontend — kickoff prompt:

```text
You are bootstrapping the FRONTEND of this monorepo, inside apps/fe/ only.
Specs, in precedence order:
- docs/spec/init-monorepo-contract/ — monorepo rules; its 01 §4 deltas WIN over stack defaults.
- docs/spec/init-react/ — your architecture spec; adopt its 00-system-prompt.md.

1. Product idea: staff-facing admin for a dress-rental shop. Feature routes mirror
   feature_list.json: dresses (catalog + detail with booked-ranges calendar), rentals
   (create/return + availability check), today (due out / due back board).
   - openapi.json: ../../packages/contract/openapi.json (REAL, from step 2 — set orval input
     to this path per init-monorepo-contract 01 §4.1)
   - Auth: <bearer+refresh | cookie — match what apps/be shipped>
   - Languages: vi (primary), en. PWA: yes — staff install it on the shop tablet/phone.
2. Package name MUST be "fe". VITE_API_BASE_URL: dev http://localhost:3000 (or Vite proxy),
   prod same-origin '' (init-monorepo-contract 03 §3).
3. HARNESS ALREADY EXISTS at repo root — do NOT create harness files under apps/fe; update
   the root ones (infra/fe-bootstrap entry) instead.
4. Output the 9-section scaffold and STOP for my approval.
```

### 5. Prove it: `bash init.sh` from a clean checkout — all gates green, then start features
(`rentals/create-rental` first; each feature = BE slice → `pnpm contract` → FE slice, one
`feature_list.json` entry).

## Root commands

| Command | What it does |
| --- | --- |
| `pnpm contract` | emit spec from BE + regenerate FE client (run after ANY BE API change) |
| `pnpm contract:check` | same + `git diff --exit-code` — the drift gate; run before push |
| `pnpm check` | BE build + FE tsc — catches FE code stale against changed types |
| `pnpm lint` / `pnpm arch` / `pnpm test` / `pnpm build` | fan out to both apps |
| `bash init.sh` | full resume verification (harness) |

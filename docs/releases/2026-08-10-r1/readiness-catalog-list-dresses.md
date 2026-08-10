# Readiness — catalog/list-dresses: list/search the catalog + one-time CSV import (FR-CAT-01, 02, 04)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (backfilled) | [catalog-aggregate.md](../../design/catalog-aggregate.md), written as-built 2026-08-04 (`f215d7b`), re-synced to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) 2026-08-09. Glossary drift worth knowing: the SRS title says status `available / renting / cleaning / retired`, the model stores only `active/retired` — renting and cleaning are DERIVED from rentals. Recorded in the ledger as a deliberate bootstrap deviation, still true on the release SHA |
| All harness gates green | ok | Ledger (2026-07-30): build / lint / arch (139 modules, 0 violations) / test (41). Re-verified 2026-08-10 on the release SHA with the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | `GET /dresses` + `POST /dresses` in `packages/contract/openapi.json`; the FE list/search surface uses the generated hooks. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below — unusually well covered for a pre-AC entry, because the CSV import was proven against a 200-row file |
| Migration has a rollback plan | no-migration | Uses the `dresses` table from `1753830000001_init.js` (`infra/be-bootstrap`) |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-CAT-02: list/search by code, size, status, paginated | `smoke.sh`: `GET /dresses?q=VD-001` count ≥1; FE list/search/status-filter/pagination component tests |
| 2 | FR-CAT-04: the shop's ~200-row Google-Sheets CSV imports in one command | `pnpm --filter be import:dresses`: sample = `imported=3`; a generated 200-row file = `imported=200` exit 0 |
| 3 | Re-running the import cannot duplicate the catalog | Re-run = `skipped(duplicate)=200`, exit 0 |
| 4 | A malformed row fails loudly and is NOT inserted | Bad CSV = `imported=1 failed=2`, exit 1, per-record messages, bad rows absent from the table |
| 5 | Vietnamese and en-US money formats both parse | `GET /dresses` after import: VD-550 price 800000 from `"800,000"`, deposit 1600000 from `1.600.000`; 9 parser specs (quoted commas/newlines, BOM, CRLF, header order) |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| The import is a step in the release plan ([step 5](./release-plan.md)) and the shop's real CSV is prerequisite P6 — the file is not in the repo, so the import has never been run against the actual catalog | bangnk | _open_ — exposure: an import failure on go-live day leaves staff with an empty catalog. Rehearse it against a copy of the production DB first |

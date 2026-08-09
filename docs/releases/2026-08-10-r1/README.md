# Release 2026-08-10-r1 — the first deployment

Produced by the [`init-release`](../../spec/init-release/README.md) lane on 2026-08-10, from a ledger
that was 20/20 `pass`. The lane **prepares and verifies; it never deploys** — every step below is
executed by a person.

> **STOP — awaiting go/no-go decision.** Nothing here has been run. The release cannot start until
> the seven prerequisites in [release-plan.md §1](./release-plan.md) exist and the release-wide
> unchecked items R1–R4 carry an explicit accepted-risk note from bangnk.

## The documents

| File | What it is |
| --- | --- |
| [release-plan.md](./release-plan.md) | Release-wide readiness (§0) + risks R1–R4, the missing prerequisites P1–P7 (§1), the ordered steps with commands and verifications (§2), and the compatibility matrix (§3) |
| [rollback.md](./rollback.md) | Trigger thresholds, reversal steps cheapest-first, and why step 4 (schema reversal) is destructive |
| [record.md](./record.md) | Seeded record — SHAs, migrations, go/no-go and known issues are filled by the humans running the plan |
| `readiness-<feature-id>.md` | One per candidate feature, below. The four release-wide rows point at §0 instead of being repeated 20 times |

## Candidate features (all 20 entries of `feature_list.json`, all `pass`)

| Feature | Readiness | Note |
| --- | --- | --- |
| `infra/monorepo-skeleton` | [readiness](./readiness-infra-monorepo-skeleton.md) | build + gate structure |
| `infra/be-bootstrap` | [readiness](./readiness-infra-be-bootstrap.md) | FR-AUTH-01..03; owns migrations 0001–0002 |
| `infra/fe-bootstrap` | [readiness](./readiness-infra-fe-bootstrap.md) | staff SPA |
| `catalog/list-dresses` | [readiness](./readiness-catalog-list-dresses.md) | FR-CAT-01, 02, 04 — the CSV import the shop needs on day 1 |
| `catalog/manage-dress` | [readiness](./readiness-catalog-manage-dress.md) | FR-CAT-01, 03; migration 0003 |
| `rentals/create-rental` | [readiness](./readiness-rentals-create-rental.md) | FR-RENT-01, 02 — the core capability |
| `rentals/availability-check` | [readiness](./readiness-rentals-availability-check.md) | FR-RENT-03 |
| `rentals/return-rental` | [readiness](./readiness-rentals-return-rental.md) | FR-RENT-05 — the money path |
| `rentals/today-board` | [readiness](./readiness-rentals-today-board.md) | FR-RENT-04, 07 |
| `rentals/list-rentals` | [readiness](./readiness-rentals-list-rentals.md) | FR-RENT-08 |
| `rentals/cancel-rental` | [readiness](./readiness-rentals-cancel-rental.md) | FR-RENT-06 |
| `payments/list-payments` | [readiness](./readiness-payments-list-payments.md) | FR-PAY-01 |
| `infra/e2e-playwright` | [readiness](./readiness-infra-e2e-playwright.md) | the browser proof |
| `infra/qr-admin-bootstrap` | [readiness](./readiness-infra-qr-admin-bootstrap.md) | second SPA — raises prerequisite P3 |
| `qr/create-url-code` | [readiness](./readiness-qr-create-url-code.md) | FR-QR-01..05; migration 0004; least runtime-proven |
| `qr/styled-svg-rendering` | [readiness](./readiness-qr-styled-svg-rendering.md) | FR-QR-06 |
| `infra/outcome-model` | [readiness](./readiness-infra-outcome-model.md) | ADR 0001; 6 ACs |
| `infra/invariant-proof-e2e` | [readiness](./readiness-infra-invariant-proof-e2e.md) | 4 ACs; proves the DB constraints |
| `rentals/settle-late-fee` | [readiness](./readiness-rentals-settle-late-fee.md) | FR-RENT-09; 4 ACs; full spec-before-code lane |
| `infra/e2e-ci` | [readiness](./readiness-infra-e2e-ci.md) | landed this session; no production surface |

## What the readiness pass actually found

1. **Nothing about deploying this product exists in the repo.** No PM2 definition, no Nginx conf, no
   TLS, no backup procedure — P1–P7. The steps are written; the artifacts they name have to be
   created first.
2. **NFR-03 is load-bearing.** `configureApp()` never enables CORS, so if the SPAs are not served
   from the same origin as `/api`, every call fails. That makes the Nginx vhost a functional
   requirement, not a deployment preference.
3. **Every migration `down` is a `DROP`.** Reversal is safe exactly once — before the shop enters
   data. After that the only supported reversal is restore-from-backup, and the backup (P5) does not
   exist.
4. **No observability at all** (R1), no feature flag (R2), one person as owner and on-call (R3), and
   no cross-version contract test (R4). Those four rows are `missing` on every single feature.
5. **Two features are thinner than the ledger's uniform `pass` suggests**: `qr/create-url-code` has
   no live-database or browser proof, and `qr/styled-svg-rendering` has never been printed and
   scanned. Both are recorded in their own files rather than smoothed over here.

Local addition, not from the lane's template: this index. The lane names four artifact kinds
(`readiness-<feature-id>.md`, `release-plan.md`, `rollback.md`, `record.md`); with 20 readiness files
a table of contents earns its place.

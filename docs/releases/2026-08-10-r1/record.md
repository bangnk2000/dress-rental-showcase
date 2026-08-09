# Release Record — 2026-08-10-r1

Seeded by the release-prep lane; **the decision fields are filled by the humans who run the plan**,
during and after execution. An empty field means it has not happened yet — do not pre-fill it.

| Field | Value |
| --- | --- |
| BE deployed | _{{SHA/tag}} at {{timestamp}}_ |
| FE deployed | _{{SHA/tag}} at {{timestamp}}_ — same SHA as BE (invariant 5) |
| QR Admin deployed | _{{SHA/tag}} at {{timestamp}}_ — same SHA |
| Migrations applied | expected: `1753830000001_init`, `1753830000002_rentals_payments`, `1753830000003_dress_photos`, `1754300000000_qr_links` — record what `SELECT name FROM pgmigrations ORDER BY id` actually returns |
| Seed + import | owner account seeded: _{{yes/no}}_ · catalog imported: _{{imported=N failed=0}}_ |
| Flag states | none — the codebase has no feature flags (full-on release) |
| Go/no-go | _{{GO / NO-GO}} — decided by {{name}} on {{date}}_ |
| Known issues | _{{list, or "none"}}_ |
| Features released | all 20 entries of [`feature_list.json`](../../../feature_list.json); readiness per feature in this folder |

## Prerequisites — fill before go/no-go

Each of these is `missing` in the plan ([release-plan.md](./release-plan.md) §1) and blocks by
default. Record how it was satisfied, or the explicit accepted risk and until when.

| # | Prerequisite | Satisfied by | Date |
| --- | --- | --- | --- |
| P1 | PM2 process definition | | |
| P2 | Nginx vhost for the staff SPA + `/api` proxy (same origin) | | |
| P3 | Origin + vhost for QR Admin | | |
| P4 | Production JWT secrets and owner password | | |
| P5 | `pg_dump` backup with a proven restore | | |
| P6 | The shop's catalog CSV | | |
| P7 | TLS certificate | | |

## Post-release close-out

1. Append `released in 2026-08-10-r1 (docs/releases/2026-08-10-r1/record.md)` to each released
   feature's `evidence` field in `feature_list.json` — the harness has no `released` status, so this
   record IS the proof (`docs/spec/init-release/01-readiness-and-rollout.md` §5).
2. File every known issue as a backlog entry; anything found in production after go-live belongs to
   the evolution/incident lane, not to this release.
3. If the release was rolled back, say so here with the trigger that fired and the step that stopped
   it — a NO-GO record is as valuable as a GO one.

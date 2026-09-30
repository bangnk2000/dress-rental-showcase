# Release 2026-09-30-r2 — R2 photos, public listings and the public website

**Post-deployment retrospective — an exception to the release lane, not evidence that it ran.**
Produced with the [`init-release`](../../spec/init-release/README.md) templates on 2026-09-30, from a
ledger that was 43/43 `pass`, after the rollout it describes. init-release requires every unchecked item
to carry an explicit accepted-risk note BEFORE step 1; here R1–R11 were not accepted beforehand and
remain `_open_` until bangnk writes the notes — nobody else, including any agent, can accept them.

> **Written AFTER the rollout, not before it.** The plan in this pack was executed on 2026-09-30
> between 16:00 and 16:35 (+07) on the owner's direct instruction ("triển khai đi"), from the
> machine-specific runbook outside the repo (`~/deploy-dress/tencent/RUNBOOK.md` §11). The lane's
> order is readiness → go/no-go → rollout; this time it ran rollout → readiness. So
> [record.md](./record.md) records what happened instead of waiting to be filled, and every
> unchecked item below is an **accepted-after-the-fact** risk that bangnk still has to own
> explicitly. That inversion is itself a finding (release-plan.md R9).

Target: the Tencent VPS behind Cloudflare — staff CMS `https://cms.example.com`, public site
`https://example.com` (new), photo bucket `dress-rental-prod-media` served from `https://img.example.com`
(new). Before this release the box ran `2ca3e8b` (deployed 2026-09-24 without a pack).

## The documents

| File | What it is |
| --- | --- |
| [release-plan.md](./release-plan.md) | Release-wide readiness (§0), risks R1–R11, prerequisites P1–P8 and how each was met (§1), the steps as executed (§2), compatibility matrix (§3) |
| [rollback.md](./rollback.md) | Triggers, reversal cheapest-first (web off → CMS → BE code-only), what the two migration `down`s really do |
| [record.md](./record.md) | What actually happened, with timestamps, SHAs, migrations, data counts, deviations |
| `readiness-<feature-id>.md` | One per feature below — link collections into the ledger, not re-told evidence |

## Candidate features — code merged after `2ca3e8b` (PRs #12–#22), all `pass`

| Feature | Readiness | Note |
| --- | --- | --- |
| `infra/web-bootstrap` | [readiness](./readiness-infra-web-bootstrap.md) | third app, third generated client; first production run |
| `web:public-pages` | [readiness](./readiness-web-public-pages.md) | FR-WEB-01..04 pages (built on mock data, now live data) |
| `catalog/dress-photo-upload` | [readiness](./readiness-catalog-dress-photo-upload.md) | FR-CAT-10/11 — browser → R2 signed PUT; **new external dependency** |
| `catalog/photo-upload-on-submit` | [readiness](./readiness-catalog-photo-upload-on-submit.md) | batch signing on Save; changed the upload-urls body shape |
| `infra/e2e-buffer-pin` | [readiness](./readiness-infra-e2e-buffer-pin.md) | test harness only — no production surface |
| `catalog/public-listing` | [readiness](./readiness-catalog-public-listing.md) | FR-CAT-09 — DressListing aggregate, migration, **first anonymous endpoints** |
| `catalog/listing-styles` | [readiness](./readiness-catalog-listing-styles.md) | rename occasions → styles; migration with a lossy `down` |
| `web:public-catalog-live` | [readiness](./readiness-web-public-catalog-live.md) | web reads `/public/dresses`, ISR 300 s |
| `be:listings-from-dresses` | [readiness](./readiness-be-listings-from-dresses.md) | CLI; **run on production data** (100 drafts) |
| `infra/web-standalone` | [readiness](./readiness-infra-web-standalone.md) | the deploy unit + the `HOSTNAME=localhost` rule |

## Live in production but examined by NO pack — release debt

These reached production through deploys that had no readiness pass (the old VPS 2026-08-29, the
LAN box, Tencent 2026-09-24). This pack does not cover them and does not pretend to: they have
ledger evidence but no readiness checklist, no compatibility analysis, no recorded go/no-go.

`rentals/settlement-clarity`, `rentals/dress-availability-in-picker`, `catalog/dress-thumbnails`,
`fe:board-and-confirm-ergonomics`, `payments/record-collection`, `rentals/pickup-before-return`,
`catalog/purchase-price`, `catalog/price-history`, `catalog/dress-category`, `identity/manage-users`,
`rentals/rental-discount`, `catalog/duplicate-dress`, `rentals/update-rental` — 13 features, three of
them money paths (`payments/record-collection`, `rentals/rental-discount`, `rentals/update-rental`).

## Go/no-go

Recorded in [record.md](./record.md): **GO**, given by bangnk on 2026-09-30 before the rollout,
without this pack. The pack now asks for the after-the-fact ownership of R1–R11.

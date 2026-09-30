# Readiness — catalog/public-listing: DressListing aggregate, CMS `/website`, first anonymous endpoints (FR-CAT-09, FR-WEB-05 BE)

New aggregate with DB-enforced invariants, a migration, six commands, and the first `@Public()` routes of the API.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | [`public-listing.md`](../../design/catalog/public-listing.md) approved 2026-09-25, as-built note with 12 recorded choices; outcomes added to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) |
| All harness gates green | ok | `testedAt` 2026-09-29; be unit 263, be e2e 145 → 146 (publish-vs-detach race), fe 167, Playwright 1/1; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | ok (type-level) | `/listings*`, `/public/dresses*`, `DressResponseDto.listings` in all clients |
| Acceptance criteria coverage | ok | below |
| Migration has a rollback plan | ok, destructive down | `1755500000000_dress_listings`; `down` = DROP both tables ([rollback](./rollback.md) §4) |
| Observability for new behavior | **missing** | no count of 429s on `/public/*`, no publish/unpublish audit. [§0](./release-plan.md) R1, R5 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| R1 | slug unique + format; Vietnamese slugify | ledger: VO + UNIQUE + CHECK, unit (diacritics, đ→d), raw INSERT e2e |
| R2 | slug locked once first published | ledger: conditional UPDATE e2e |
| R3 | published ⇒ ≥ 1 photo | ledger: entity + CHECK `dress_listings_published_has_photo` |
| R4 | styles from the fixed set (was occasions) | ledger + `catalog/listing-styles` S1 |
| R5 | web sees only published listings with ≥ 1 active dress | ledger: public-catalog e2e; production: 0 published → `[]` |
| R6 | public DTOs are a whitelist | ledger: exact key-set e2e |
| R7 | duplicating a dress copies memberships | ledger: duplicate e2e |
| R8 | staff delete only never-published; owner any | ledger: policy e2e |
| P | publish needs photo + active dress; idempotent | ledger: `missing[]` e2e + race fix `555bac6` |
| B | badge hot > new > available | ledger: 30-day boundary unit |
| T | `/public/*` rate-limited (429), staff routes not | ledger: throttle e2e (`PUBLIC_THROTTLE_SKIP_LOOPBACK=false`); production: in-memory, one process (R5) |
| FE | CMS `/website` per the UI state matrix; dress detail shows its listings | ledger: fe 167 + Playwright |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| Throttler counters live in process memory: every API restart (each `serve.sh`, R10) resets them | bangnk | _open_ |
| `X-Forwarded-For` trust is loopback-only; behind Cloudflare the key is the real IP only because nginx takes it from `CF-Connecting-IP` (harden.sh real_ip) | bangnk | _open_ — re-run `harden.sh` when Cloudflare ranges change |

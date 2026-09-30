# Readiness — catalog/listing-styles: "Loại" (styles) instead of "Dịp" (occasions)

Rename end to end plus a data rewrite. Production had no listings when it migrated, so the rewrite touched 0 rows.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | [`public-listing.md`](../../design/catalog/public-listing.md) §Amendment 2026-09-30 (3 owner decisions) |
| All harness gates green | ok | `testedAt` 2026-09-30; be unit 264, be e2e 146 → 148, fe 167, web 27; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | ok (type-level) | `occasions` → `styles`, `?style=`, three clients regenerated |
| Acceptance criteria coverage | ok | below |
| Migration has a rollback plan | ok, **lossy down** | `1755600000000_listing_styles`; `down` collapses styles to `ao-dai`/`gala` ([rollback](./rollback.md) §4). `migrate:down` + `migrate` proven on the dev DB |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| S1 | fixed set of six codes, labels only in translations | ledger: raw INSERT `{short,prom}` blocked by CHECK |
| S2 | renamed in DB, API, query and all clients | ledger: contract regenerated, `?style=` e2e |
| S3 | existing rows migrate; migration reversible | ledger: down + up on dev; production: 0 rows at migrate time |
| S4 | CMS and web say "Loại" with Vietnamese labels | ledger: fe + web label tests |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Nothing specific to this entry.

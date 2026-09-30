# Readiness — catalog/dress-photo-upload: browser → R2 signed upload + Cloudflare Images delivery (FR-CAT-10, FR-CAT-11)

Adds the product's first external runtime dependency (R2 + Cloudflare Images) and the first write path that bypasses the BE.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | [`dress-photo-upload.md`](../../design/catalog/dress-photo-upload.md), owner-approved after 3 Q&A rounds, spike §7.1, as-built §8 |
| All harness gates green | ok | `testedAt` 2026-09-25; be unit + `photo-upload-url` e2e, fe vitest, `packages/image-url` tests; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | ok (type-level) | `POST /photos/upload-urls` in the contract, all clients regenerated |
| Acceptance criteria coverage | ok | below |
| Migration has a rollback plan | no-migration | `photo_urls` unchanged |
| Observability for new behavior | **missing** | an upload fails in the staff browser; the BE only sees the signing call. [§0](./release-plan.md) R1 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| R1 | JPEG/PNG/WebP ≤ 10 MB enforced in CMS, at signing and by R2 | ledger: spike "signed 1000/sent 5000 → 403", be unit + e2e; **production**: signed headers on the prod bucket not re-tested |
| R2 | R2 secret only in BE; `@aws-sdk` only in the adapter | ledger: depcruise rule `aws-sdk-only-in-r2-adapter` |
| R3 | signing is local; missing env → 503 `PHOTO.STORAGE_UNAVAILABLE` | ledger: disabled adapter + e2e 503; production: `photo upload: ON` in `verify-external.sh` |
| R4 | ≤ 10 photos per dress | ledger: be validation + fe tests |
| R5 | removing a photo never deletes the R2 object | ledger: design decision; consequence = release-plan R6 |
| R6 | bucket accepts PUT only from the CMS origin (CORS) | ledger spike on dev; **production**: `media-setup.sh` preflight cms 204 / foreign 403 ([record](./record.md)) |
| D1 | R2 URLs rendered through `/cdn-cgi/image` variants; foreign links untouched | ledger: `packages/image-url` tests; production: variant URL 200 on `img.example.com` |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| No staff member has saved a real photo on production yet — the end-to-end browser path (sign → PUT → Save → variant) is proven on the dev bucket only | bangnk | _open_ — do one real upload and look at it on the dress detail |
| The media token has no IP filter and write access to the bucket (necessary for browser PUTs) | bangnk | _open_ — see release-plan R6 |

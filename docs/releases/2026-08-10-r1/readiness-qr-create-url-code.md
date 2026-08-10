# Readiness — qr/create-url-code: owner creates, lists, previews and downloads direct-URL QR SVGs (FR-QR-01..05)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (design gate honoured) | [SRS-qr-url.md](../../SRS-qr-url.md), [qr-aggregate.md](../../design/qr-aggregate.md) and [qr-admin.md](../../design/qr-admin.md) were approved BEFORE the code (2026-08-04). Re-synced to [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md) on 2026-08-09 |
| All harness gates green | ok | Ledger (2026-08-04): BE build / lint / arch / test = 70 Jest tests; qr-admin check / lint / test / build green. Re-verified 2026-08-10 in the full root gate run (be 95 unit, qr-admin 13). No `testedAt` field. **The ledger states plainly that no live Postgres or browser proof was run for this entry in that environment** — see below |
| Contract evidence: provider + consumer tests | ok (type-level) | `POST /qr-links`, `GET /qr-links`, `GET /qr-links/:id`, `GET /qr-links/:id/image.svg` emitted; BOTH clients regenerated in the same change. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | ok — **destructive** | `apps/be/migrations/1754300000000_qr_links.js` (table + creator FK + index); `down` = `DROP TABLE qr_links`, so reversing it destroys every QR record. Printed codes keep working — they encode the target URL directly, not a lookup — which is the one saving grace here |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | FR-QR-01/02: a QR record is IMMUTABLE — changing a printed URL means creating a new code | `QrLinkEntity` exposes no mutator; no update endpoint exists in the contract |
| 2 | FR-QR-03: only absolute `http(s)` targets, capped at 2048 chars | `TargetUrl` value object: credentials, relative, `data:` and `javascript:` all refused — unit-tested |
| 3 | The renderer never fetches the target | The `qrcode` adapter receives only the persisted string; there is no HTTP client in the QR context |
| 4 | FR-QR-04/05: owner-only create/list/read, SVG preview and download behind a bearer token | `qr:create` / `qr:list` / `qr:read` policies (fail-closed registry); the qr-admin app performs owner sign-in, history query and Blob preview/download |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry — this is the least runtime-proven feature in the
release:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| **No live-Postgres and no browser proof** for the QR path: the ledger says so explicitly, no `apps/be/test/` e2e spec covers `qr`, and the Playwright happy path does not visit QR Admin | bangnk | _open_ — the SQL, the FK, the policies and the SVG download are proven by unit tests and by nothing else. Exercise it by hand at release step 7/8 before printing anything |
| A staff (non-owner) account has never been shown to receive 403 here | bangnk | _open_ — the guard is fail-closed by construction; still unproven end to end |
| The QR image is served through an authenticated endpoint, so a printed code's TARGET is public while its record is not — make sure nothing private is ever encoded | bangnk | _open_ — a printed QR is public by nature; the app cannot revoke one |

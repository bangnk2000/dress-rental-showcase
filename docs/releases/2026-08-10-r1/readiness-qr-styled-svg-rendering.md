# Readiness — qr/styled-svg-rendering: the shop's pink-red QR frame with a thank-you caption (FR-QR-06)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok | [qr-aggregate.md](../../design/qr-aggregate.md) + [SRS-qr-url.md](../../SRS-qr-url.md) FR-QR-06. Styling is fixed by design (no per-code theming), which is what keeps the rendering testable |
| All harness gates green | ok | Ledger (2026-08-06): focused Jest renderer test plus BE lint, build and arch. Re-verified 2026-08-10 in the full root gate run. No `testedAt` field |
| Contract evidence: provider + consumer tests | n/a | No API surface changed — the existing authenticated Blob preview and SVG download pick up the new rendering automatically |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Rendering only |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | The decoration never touches the scannable area | The QR library's output is nested UNCHANGED inside the frame, keeping its own white quiet zone; hearts, frame and caption sit outside it — asserted by the renderer test |
| 2 | Scannability is protected against the decoration | Error correction level `H` |
| 3 | The encoded value is still the plain target URL | The adapter passes the persisted string through; no redirect or shortener is introduced |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| **No physical scan test.** Nothing has verified that a PRINTED code from this renderer scans on a phone — the proof is structural (quiet zone preserved, `H` correction), not empirical | bangnk | _open_ — print one and scan it with two phones before the shop prints a batch. A QR that fails at 5cm is discovered by a customer, not by CI |
| The caption and colours are hard-coded; changing them is a deploy | bangnk | _open_ — accepted: one shop, one style |

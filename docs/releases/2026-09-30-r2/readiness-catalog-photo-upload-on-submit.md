# Readiness — catalog/photo-upload-on-submit: photos upload only on Save, one signing batch

Revision of the upload flow; changed the `POST /photos/upload-urls` body to `{ files[] }`.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names consistent with glossary | ok | owner decisions in [`dress-photo-upload.md`](../../design/catalog/dress-photo-upload.md) §9 |
| All harness gates green | ok | `testedAt` 2026-09-29; be unit 208, be e2e `photo-upload-url` 13/13, fe vitest 137; entry in [`feature_list.json`](../../../feature_list.json) |
| Contract evidence | ok (type-level) | body shape change regenerated in all clients; the old single-file shape now → `GENERIC.VALIDATION` |
| Acceptance criteria coverage | ok | below |
| Migration has a rollback plan | no-migration | — |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none — full-on ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| S1 | choosing/removing photos or closing the form sends nothing | ledger: fe tests "no request on choose", "close dialog → no request" |
| S2 | Save signs every file in ONE request and PUTs each; dress saved only when all uploaded | ledger: photo-list-field + dresses tests |
| S3 | a failed PUT keeps the dress unsaved; next Save re-signs only the failed ones | ledger: "re-sign only failed" |
| S4 | a wrong-type/too-large photo blocks Save; one bad file fails the batch with `files.<i>` | ledger: be e2e index-named 400 + fe server-named index |
| S5 | a just-uploaded photo keeps its local preview; 160/1280 variants, never the original | ledger: fe tests blob preview kept, variant widths |

### Unchecked items

Release-wide R1–R11 in [§0](./release-plan.md) apply. Nothing specific to this entry.

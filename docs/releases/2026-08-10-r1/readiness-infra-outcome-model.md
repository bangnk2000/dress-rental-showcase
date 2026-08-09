# Readiness — infra/outcome-model: business outcomes survive the HTTP boundary

The first entry in this release that went through a real design gate: [ADR 0001](../../adr/0001-outcome-model-at-the-http-boundary.md)
was approved — decision, full outcome catalog §3, UI state matrix §4, rejected alternatives — before
any code was written.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok (real design gate) | ADR 0001 approved first; `SRS-dress-rental.md` (FR-AUTH-02, FR-RENT-02, BR-1) and the rentals / catalog / identity / qr-admin design docs were re-synced in the SAME change; `docs/design/README.md` gained the B2.1 outcome-catalog lane and an ADR index. Every outcome code in the running system appears in ADR 0001 §3 — that IS the glossary |
| All harness gates green | ok | `testedAt` 2026-08-09. be test 82 (incl. `exception.filter.spec` for both wire shapes), fe test 53, qr-admin 13, be `test:e2e` 22 asserting exact outcome bodies over HTTP, root check / lint / arch / builds, `pnpm contract` idempotent (md5 identical). Re-verified 2026-08-10: be 95 + 30 e2e, fe 57, qr-admin 13 |
| Contract evidence: provider + consumer tests | ok (type-level) | Nine controllers declare `@ApiResponse({ status: 422, type })` with per-slice outcome DTOs, so the outcome shapes are IN the contract and reach both generated clients. After the regenerated layer was committed, `contract:check`, the arch freshness item and a full `bash init.sh` were green. Drift gates per [§0](./release-plan.md) |
| Acceptance criteria coverage | **ok** | 6 ACs, each with named evidence — see below |
| Migration has a rollback plan | no-migration | Wire shapes only |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 — and this is the feature that MAKES observability cheap: every rejection now has a stable snake_case code that a counter could group by. Nothing counts them yet |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| AC1 | Every business rejection returns 422 (403 for a named denial) with `{ status: '<snake_case>', ...payload }` from the ADR 0001 §3 catalog — no `GENERIC.*` for a rejection | `pnpm --filter be test` (`exception.filter.spec` + create-rental controller mapping); `pnpm --filter be test:e2e` asserts the exact bodies over HTTP |
| AC2 | Every technical fault returns `{ error: { code, message, details?, correlationId } }`; ValidationPipe 400s carry per-field `details[]` | Same filter spec; e2e checks 404/401 stay fault envelopes |
| AC3 | BOTH overlap paths — the pre-check and the EXCLUDE-constraint race — return the same `rejected_dress_unavailable` with `dressIds` | `rental.repository` translates the constraint error to `RentalItemsOverlapError`; `create-rental.service` converts it back to the same outcome with re-queried ids; proven by `apps/be/test/rentals-overlap.e2e-spec.ts` |
| AC4 | Login/refresh rejections are outcomes, so **401 means only "a guard rejected the access token"** | Identity controllers return outcomes; the FE 401→refresh→retry interceptor no longer has to guess |
| AC5 | `apps/fe` reads wire shapes in exactly ONE seam; the three `is-conflict-error.ts` files are gone; every code renders its designed state | `src/api/errors.ts` (`mapApiError`); `pnpm --filter fe test` 53 with per-outcome MSW cases and a fault fallback; vi+en key parity enforced by `pnpm --filter fe arch` |
| AC6 | `apps/qr-admin` uses the same seam; no status-code branching left in either client | `apps/qr-admin/src/api/errors.ts` replaced `error-message.ts`; `errors.test.ts` in the 13 |

Real-browser proof on top of the unit/e2e layers: `pnpm --filter fe e2e` passed on the new wire
shapes (sign-in, create, booking, pickup, return-and-settle, payments dialog).

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| The catalog is a maintenance contract: a new BE outcome that skips ADR 0001 §3/§4 ships a code the FE renders as a generic fault | bangnk | _open_ — enforced by review only; no gate checks that every emitted code has a UI state and an i18n key |
| `correlationId` is generated and returned but nothing correlates it — there is no request-id header, no log search, no support flow | bangnk | _open_ — a staff member reading an id off the screen has nowhere to send it (see R1) |

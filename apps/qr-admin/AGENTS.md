# AGENTS.md — apps/qr-admin (architecture contract)

Standalone Vite + React SPA for the owner-only QR URL tool, per the init-react set — entry point
`docs/spec/init-react/README.md` (open its numbered detail files only per the File Map, never the
whole folder). Product design: `docs/design/qr-admin.md`; requirements: `docs/SRS-qr-url.md`.
**Session harness lives at the repo ROOT** (`../../AGENTS.md`, `feature_list.json`, `init.sh`) —
never create harness files here.

This app is a SIBLING of `apps/fe`, not a feature inside it: it ships separately, has its own
generated client, its own token storage and its own gates. It MUST NOT import `apps/fe` source
(cross-app sharing goes through `packages/*` only — root invariant 4).

## Commands (run from repo root)

| Command | What |
| --- | --- |
| `pnpm --filter qr-admin dev -- --port 5174` | Vite dev server (`/api` proxied to BE :3000) |
| `pnpm --filter qr-admin check` / `lint` / `arch` / `test` / `build` | gates (tsc, eslint, `scripts/check-architecture.sh`, vitest, tsc + vite build) |
| `pnpm --filter qr-admin generate:api` | Orval: `packages/contract/openapi.json` → `src/api/generated/` |
| `pnpm contract` (root) | after ANY BE API change: re-emit the spec and regenerate BOTH clients |

## Rules

- `src/api/generated/**` is READ-ONLY — regenerate, never edit. "The UI needs a field" = BE change
  first, then `pnpm contract`.
- `src/api/mutator/custom-instance.ts` is the ONE HTTP door (bearer header, refresh, base URL);
  `src/api/mutator/auth-tokens.ts` owns tokens. Its localStorage key is DELIBERATELY distinct from
  `apps/fe` — the two apps do not share a session.
- `src/api/errors.ts` is the ONE seam that reads wire shapes (`mapApiError` → outcome vs fault) and
  the only place that maps a code to Vietnamese copy (`apiErrorMessage`). Components never inspect
  `error.response.status`; see [ADR 0001](../../docs/adr/0001-outcome-model-at-the-http-boundary.md)
  §4 for the state matrix.
- Server data lives in the TanStack Query cache; no copies into component state.
- Protected SVGs are fetched as bearer-authenticated Blobs (`src/api/qr-image.ts`) — never
  `<img src>` with a token, never a token in a query parameter.
- A QR record is immutable: to change a printed URL, create a new QR. No edit/delete surface.

## Deviations from the stack spec (deliberate, keep consistent)

1. **vi-only, no i18n framework** — one Vietnamese audience (the shop owner); adding i18next for a
   single locale is cost with no buyer. Copy lives inline; `src/api/errors.ts` centralises the
   error strings so a future extraction has one place to start.
2. **No PWA, no router** — the whole tool is one authenticated screen plus a login form; state is
   `signed-in` vs not. Adding a router/service worker before there is a second route is scaffolding
   for its own sake.
3. **No plop generator** — the app has one feature area; the scaffold would generate more ceremony
   than it saves. Follow the shape of `src/features/qr-url/` by hand.
4. **Hand-written `apiErrorMessage` instead of an i18n lookup** — the direct consequence of
   deviation #1, and it is where every outcome code in ADR 0001 §4 gets its copy for this app.

## Where do I add a QR capability?

1. Trace it to an FR-QR-id in `docs/SRS-qr-url.md`; tier it per `docs/design/README.md` §Quy trình.
   Has a business rejection? Its outcome code goes in ADR 0001 §3 + §4 BEFORE code.
2. BE slice first (`apps/be`, `modules/qr`) → `pnpm contract` (root) → this app's UI.
3. Extend `src/features/qr-url/` (or add a sibling feature folder); keep axios out of feature code.
4. Claim the entry in root `feature_list.json`; done = check/lint/arch/test/build green + runtime
   proof against a running BE (see the root harness).

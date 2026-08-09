# Readiness — infra/qr-admin-bootstrap: the standalone QR Admin workspace (NFR-QR-01..03)

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok | [SRS-qr-url.md](../../SRS-qr-url.md) and [qr-admin.md](../../design/qr-admin.md) were written BEFORE this bootstrap (design gate honoured for the QR phase — `claude-progress.md` 2026-08-04). Its architecture contract, [`apps/qr-admin/AGENTS.md`](../../../apps/qr-admin/AGENTS.md), came later (2026-08-09) and records four deliberate deviations: vi-only, no PWA, no router, no plop |
| All harness gates green | ok | Ledger (2026-08-04): `pnpm contract:check`, qr-admin check / lint / arch / test / build, root check / lint / arch / test / build, and `bash init.sh` all verified. Re-verified 2026-08-10: qr-admin test = 13, build green. No `testedAt` field |
| Contract evidence: provider + consumer tests | ok (type-level) | The SECOND generated consumer: `apps/qr-admin/src/api/generated/` is produced by `pnpm generate:api` and diffed by the same drift gates and the CI `contract` job ([§0](./release-plan.md)) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Frontend workspace only |
| Observability for new behavior | missing | [§0](./release-plan.md) R1 |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | NFR-QR-01: it is a genuinely independent app — it imports NO `apps/fe` source | `pnpm --filter qr-admin arch` + the ring rules; own mutator, own token boundary, own gates |
| 2 | It consumes the same one-way contract | Own Orval-generated client from `packages/contract/openapi.json`; root `contract`, `check`, `init.sh` and CI all cover BOTH clients |
| 3 | It ships as its own build | `pnpm --filter qr-admin build` green in the root gate run |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry — the deployment questions this app raises are real
blockers, not paperwork:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| **No `base` is set in `apps/qr-admin/vite.config.ts`**, so serving it under a subpath (`/qr-admin/`) breaks its asset URLs. It needs its own hostname, or a `base` + rebuild | bangnk | _open_ — prerequisite [P3](./release-plan.md); getting this wrong shows the owner a blank page |
| Its API calls need the SAME origin as the API (no CORS is enabled anywhere), so its vhost must proxy `/api` too | bangnk | _open_ — same root cause as P2. `VITE_API_BASE_URL` is the escape hatch, and using it requires CORS the backend does not send |
| No PWA, no router, vi-only, hand-written error copy — four accepted deviations from the FE contract | bangnk | _open_ — recorded in `apps/qr-admin/AGENTS.md`; owner-only tool, used rarely |

# Readiness — infra/monorepo-skeleton: workspace skeleton, contract package, CI drift gates, root harness

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok | Governed by the vendored [`init-monorepo-contract`](../../spec/init-monorepo-contract/README.md) set, not by a product design doc — the repo's shape IS the spec's output. Names still match: `apps/be`, `apps/fe`, `apps/qr-admin`, `packages/contract` |
| All harness gates green | ok | Ledger evidence (2026-07-30): `bash init.sh` passed the skeleton-only checks. Re-verified on the release SHA 2026-08-10 as part of the full gate run (`pnpm contract:check`, `check`, `lint`, `arch`, `test`, both builds). No `testedAt` field — the entry predates it |
| Contract evidence: provider + consumer tests | ok (type-level) | This entry IS the drift-gate machinery — [release-plan.md §0](./release-plan.md) |
| Acceptance criteria coverage | partial | No `acceptance` array (recorded as-built, per `feature_list.json` `rules`). De-facto criteria below |
| Migration has a rollback plan | no-migration | Skeleton only; the first schema arrives with `infra/be-bootstrap` |
| Observability for new behavior | missing | [§0](./release-plan.md) — R1 |
| Feature flag | missing | none — full-on release ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry actually claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | pnpm workspace with the four projects resolves and installs | `pnpm install --frozen-lockfile`, `pnpm -r` scripts fan out to 4 projects |
| 2 | The contract is one-way and drift is a build failure | `pnpm contract:check` + the CI `contract` job (`git diff --exit-code` on `packages/contract` and both generated clients) |
| 3 | The root harness artifacts exist and are the only ones | `AGENTS.md`, `feature_list.json`, `init.sh`, `claude-progress.md`, `session-handoff.md`, `clean-state-checklist.md` at root; none under `apps/*` |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply ([release-plan.md §0](./release-plan.md)). Nothing extra for this entry: it
ships no runtime surface — it is the build and gate structure the other 19 entries are verified with.

# Readiness — infra/e2e-playwright: the vi happy path in a real browser against the real stack

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok | Its contract is [`apps/fe/AGENTS.md`](../../../apps/fe/AGENTS.md) deviation 5, written with the code and updated twice since (scoped locators 2026-08-09, self-starting stack 2026-08-10). The spec covers exactly the flow the shop performs, in Vietnamese |
| All harness gates green | ok | Ledger (2026-07-30): FE check / lint / test (48) / build green; `1 passed` against a fresh compose stack in ~5s. Re-verified 2026-08-10 on the release SHA: `1 passed (17.1s)` with `CI=1`, now including the BE and FE server startup |
| Contract evidence: provider + consumer tests | n/a | Adds no API surface. It is, however, the ONLY test in the repo that exercises the generated client, the real BE and a real browser together — the closest thing to a consumer contract test this repo has ([§0](./release-plan.md) R4) |
| Acceptance criteria coverage | partial | No `acceptance` array (as-built). De-facto criteria below |
| Migration has a rollback plan | no-migration | Test tooling |
| Observability for new behavior | n/a | Not production behavior. Failures surface in CI ([infra/e2e-ci](./readiness-infra-e2e-ci.md)) |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

No AC array. What the entry claims, and what proves it:

| # | De-facto criterion | Evidence |
| --- | --- | --- |
| 1 | One serial spec walks the whole staff day: sign in → add a dress → book it for today → hand out → take back & settle → the list shows it returned with its payments | `apps/fe/e2e/happy-path.spec.ts`, green on the release SHA |
| 2 | It runs in Vietnamese, like the shop | `locale: 'vi-VN'` pinned — headless Chromium defaults to en and the i18n detector follows `navigator.language` |
| 3 | It does not assume an empty database | Board locators are scoped to the run's own rows (`ownRows`); the dress code and customer name carry a per-run suffix |
| 4 | **It has already caught real bugs** | Two stale-cache defects (staleTime 60s): a new rental missing from the list after create, and the list keeping a stale status after pickup/return. Both fixed by invalidating the parameterless keys |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| Coverage is ONE path: no cancel, no CSV import, no QR Admin, no late-fee waiver, no availability calendar | bangnk | _open_ — everything else is covered only below the browser. A UI-level regression outside this path reaches the counter |
| Chromium only — no Firefox, no WebKit, and the counter tablet's actual browser is untested | bangnk | _open_ — check what the tablet runs at release step 8 |

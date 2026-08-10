# Readiness — infra/e2e-ci: the browser proof runs in CI, not by hand

Landed in this same session (2026-08-10). It ships **no production surface** — it changes how the
release is verified, not what the shop runs — but it is part of the released SHA, so it is a
candidate like any other.

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | ok | Standard-tier work (no new aggregate, invariant or interaction pattern), so per `docs/design/README.md` §Quy trình B2 the filled scaffold IS the design. Its contract is [`apps/fe/AGENTS.md`](../../../apps/fe/AGENTS.md) deviation 5, rewritten in the same change |
| All harness gates green | ok | `testedAt` 2026-08-10: contract emit + `generate:api` clean (no drift), `pnpm check`, `lint`, `arch`, be 95 unit + 30 e2e, fe 57, qr-admin 13, both builds. `init.sh` itself aborted on `pnpm install --frozen-lockfile` (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`, the known local pnpm quirk), so its gates were run individually with `npm_config_verify_deps_before_run=false` |
| Contract evidence: provider + consumer tests | n/a | No API surface. It does, however, make the closest thing this repo has to a consumer contract test run on every push ([§0](./release-plan.md) R4) |
| Acceptance criteria coverage | **ok, with one honest gap** | 4 ACs below; AC2 is proven by configuration and a local equivalent, NOT yet by a real GitHub run |
| Migration has a rollback plan | no-migration | CI + test tooling |
| Observability for new behavior | n/a | Not production behavior |
| Feature flag | missing | none ([§0](./release-plan.md) R2) |
| Owner + on-call | ok | bangnk, both ([§0](./release-plan.md) R3) |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| AC1 | `pnpm --filter fe e2e` starts the stack it needs and passes on a machine that only has a migrated + seeded database | `apps/fe/playwright.config.ts` declares two `webServer`s — `pnpm --filter be build && start` on :3000 (readiness probed via `/api/v1/dresses` answering 401) and `pnpm build && vite preview --port 4173 --strictPort`. Cold run against only `docker compose up -d` + migrate + seed: **1 passed (18.2s)**; again with `CI=1` (so `reuseExistingServer` is off): **1 passed (17.1s)**. The browser now exercises the PRODUCTION build, service worker included — `vite.config.ts` gained the matching `preview.proxy` for `/api` |
| AC2 | The same command runs as a CI job on every push/PR with its own postgres service, and fails the build | New `e2e` job in `.github/workflows/ci.yml`: postgres service, `playwright install --with-deps chromium`, `pnpm --filter be migrate`, `pnpm --filter be seed` (`SEED_OWNER_PASSWORD=changeme`, the pair the spec signs in with), then `pnpm --filter fe e2e`. YAML parses; 5 jobs. **Not yet observed on a real GitHub run — the first push to this branch is what proves it** |
| AC3 | A developer who runs the stack by hand keeps the documented flow | With `E2E_BASE_URL` set, `webServer` is `undefined`: a run against a dead port emitted **0 `[WebServer]` lines** and failed in seconds instead of booting Nest and Vite |
| AC4 | A failed CI run leaves a downloadable report/trace | The `html` reporter (`open: 'never'`) is configured; the same failing run produced BOTH `apps/fe/playwright-report/` and `apps/fe/test-results/<test>/trace.zip` — exactly the two paths the job uploads on failure |

### Unchecked items (each one blocks until owned)

Release-wide R1–R4 apply. Extra for this entry:

| Item | Owner | Accepted-risk note (bangnk fills) |
| --- | --- | --- |
| AC2 has never run on GitHub Actions — CI-only failure modes (browser download, `--with-deps` privileges, the postgres service hostname, cold-cache timeouts) are unproven | bangnk | _open_ — cheap to close: push the branch and read the run. Until then the job is *written*, not *green* |
| The job seeds the owner with the public password `changeme`, deliberately, on a throwaway database | bangnk | _open_ — safe in CI, and exactly why production prerequisite [P4](./release-plan.md) exists |
| Coverage is still the single happy path (see [infra/e2e-playwright](./readiness-infra-e2e-playwright.md)) — automating it does not widen it | bangnk | _open_ — the automation makes adding a second spec worth doing; nothing yet does |

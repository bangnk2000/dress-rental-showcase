# CI Gates & Ship-Together Runtime

## 1. The Three Drift Gates

The whole anti-drift promise reduces to three CI lines, run on every PR, in this order:

```bash
pnpm openapi:emit  && git diff --exit-code packages/contract           # 1. BE code ↔ contract
pnpm generate:api  && git diff --exit-code apps/fe/src/api/generated   # 2. contract ↔ FE client
pnpm check                                                             # 3. FE client ↔ FE usage (be build + fe tsc)
```

Coverage map — every way the sides can lag, and which line catches it:

| Drift | Caught by |
| --- | --- |
| BE API changed, contract not regenerated | gate 1 |
| Contract changed (or hand-edited), FE client stale | gate 2 |
| Generated client hand-edited | gate 2 (regeneration reverts the edit → diff) |
| Client types changed, FE components still on old shapes | gate 3 (`fe check` = `tsc --noEmit`) |
| Contract hand-edited to "unblock" FE without a BE change | gate 1 (emit restores truth → diff) |

`pnpm contract:check` (01 §2) is gates 1+2 as a single local command — run it before push.

## 2. The Workflow File — `.github/workflows/ci.yml`

Contract gates are a separate, fast job (no DB, no browser — the offline-boot rule 02 §2 is
what keeps it fast); per-app gates come from each stack set unchanged and run in parallel.

```yaml
name: ci
on:
  pull_request:
  push: { branches: [master] }

jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm openapi:emit
      - run: git diff --exit-code packages/contract
      - run: pnpm generate:api
      - run: git diff --exit-code apps/fe/src/api/generated
      - run: pnpm check

  be:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter be lint && pnpm --filter be arch
      - run: pnpm --filter be test
      # + migrate/test:e2e with services per init-nestjs-hexagonal 09/12

  fe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter fe lint && pnpm --filter fe arch
      - run: pnpm --filter fe test
      - run: pnpm --filter fe build
```

Optional hardening, add when the team grows past one:

- **Breaking-change visibility:** `oasdiff breaking <base>/openapi.json <head>/openapi.json`
  as a PR comment/label. Solo, gate 3 already fails the build on breakage — oasdiff adds
  review-time signal, not safety.
- **Local pre-push hook** running `pnpm contract:check` (lefthook/husky) — saves the CI round
  trip; never a REPLACEMENT for the CI gates.

## 3. Ship Together — one deployable unit, zero version skew

The gates make dev-time drift impossible; runtime drift (new FE talking to old BE) is closed
by deployment topology, not code review:

- **One artifact.** Multi-stage Dockerfile: build `fe` → copy `apps/fe/dist` into the BE
  image → NestJS `ServeStaticModule` serves it (SPA fallback to `index.html`), API under a
  global prefix (`/api`). Alternative with identical semantics: nginx on the same host serving
  `dist/` + proxying `/api` — choose one, record it in `AGENTS.md`.
- **Same origin in prod** → `VITE_API_BASE_URL=''` (01 §4.5), no CORS configuration to
  maintain, session cookie flows (init-react 05) work without cross-site caveats.
- **Dev** stays two processes (`pnpm --filter be start:dev`, `pnpm --filter fe dev`) with a
  Vite `server.proxy` for `/api` — mirroring the prod same-origin shape instead of enabling
  permissive CORS you'd never ship.

Deploying FE and BE separately (CDN + API host) is a legitimate later optimization — but it
reintroduces version skew as a reachable state, so it requires the contract to be additive-only
(expand/contract discipline) from that day on. Do not pay that cost before something forces it.

## 4. Smells

- The contract job pulling Docker services — the offline-boot trap (02 §2) is being papered
  over.
- `git diff --exit-code` gates green but `pnpm check` red on main — someone merged with
  `--no-verify` or CI isn't required on the branch; fix branch protection, not the code first.
- A CORS allow-list growing in prod config — you've drifted from same-origin without deciding
  to (§3).
- CI regenerating artifacts and **committing** them back (auto-fix bots) — the gate exists to
  make the developer's PR carry the whole truth; auto-commits hide exactly what review needs
  to see.
- FE deployed from a different pipeline than BE "temporarily" — that's the two-repo world's
  failure mode, reintroduced voluntarily.

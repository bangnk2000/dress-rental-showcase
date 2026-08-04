# Polyrepo Variant — the Same Contract Across Two Repos

Use this file when BE and FE **cannot** share a repo (separate teams/release trains, or the
split already happened and merging is off the table). Everything else in this set still applies —
one-way contract, generated artifacts never hand-edited, drift caught by `git diff` gates. What
the monorepo gave you for free and this file must replace is **atomicity**: there is no single
PR carrying BE change + contract + FE client together, so a reachable state exists where the two
sides disagree. The replacement is three mechanisms: **pinning**, a **breaking-change gate**,
and **drift notification**.

If you are one team on one release train, do not build this — the monorepo (00–04) is strictly
cheaper. If you are two repos but keep finding both sides in every feature, that is the signal
to RETROFIT into the monorepo (00), not to harden this pipeline.

## 1. The Chain, Split Across Repos

```
BE repo                                    FE repo
─────────────────────────────              ─────────────────────────────
apps source (DTOs + decorators)            openapi.json        ← vendored, pinned copy
  │ openapi:emit (offline, 02 §2)          .contract-version   ← the BE commit SHA it came from
  ▼                                          │ contract:pull (deliberate upgrade only)
docs/openapi.json  ← committed             │ generate:api (Orval, init-react 04 — unchanged)
  gate: openapi:check                        ▼
  (emit + git diff --exit-code)            src/api/generated/  ← committed
  gate: oasdiff breaking (§3)                gate: generate:api + git diff --exit-code
```

Both repos keep the freshness gates they already have. The new parts: the FE consumes a **pinned
snapshot**, never "whatever BE main has today", and the BE CI refuses undeclared breaking
changes.

## 2. Pinning — `contract:pull` + `.contract-version`

The FE vendors the spec plus a one-line file recording exactly which BE commit it mirrors:

```jsonc
// fe repo: .contract-version
{ "repo": "<org>/<be-repo>", "sha": "<40-char commit sha>", "pulledAt": "2026-07-31" }
```

```bash
# fe repo: scripts/contract-pull.sh  (wired as `pnpm contract:pull [<sha>]`)
SHA="${1:-$(git ls-remote https://github.com/$BE_REPO HEAD | cut -f1)}"
curl -fsSL "https://raw.githubusercontent.com/$BE_REPO/$SHA/docs/openapi.json" -o openapi.json
node -e "require('fs').writeFileSync('.contract-version', JSON.stringify({repo: process.env.BE_REPO, sha: '$SHA', pulledAt: new Date().toISOString().slice(0,10)}, null, 2) + '\n')"
pnpm generate:api
```

Rules:

- **Upgrading the contract is a deliberate act**: run `contract:pull`, commit
  `openapi.json` + `.contract-version` + regenerated client **together**; `pnpm check` and the
  tests show exactly where the FE must adapt. This commit is the polyrepo's stand-in for the
  monorepo's atomic PR — it carries the whole truth of one contract bump.
- The FE's CI freshness gate stays `pnpm generate:api && git diff --exit-code src/api/generated
  openapi.json` — it proves the client matches the **pinned** spec, and that nobody edited
  either by hand. A manually replaced `openapi.json` with an untouched `.contract-version` is
  caught in review by the mismatched pair.
- One consumer, same owner: raw-file pull at a SHA is enough. **Two or more consumers** (second
  SPA, mobile): promote the spec to a published artifact — an npm package
  (`@<org>/contract`, semver, published by BE CI on merge) — and pin by version instead of SHA.
  Do not build the package registry ceremony for a single consumer.

## 3. The Breaking-Change Gate (BE CI) — the atomicity replacement

In the monorepo, a breaking BE change turns the FE red **in the same PR** (03 §1 gate 3). In the
polyrepo nothing turns red until the FE pulls — possibly weeks later. So the BE CI must refuse
undeclared breakage at the source:

```yaml
# be repo CI, after openapi:check
- run: git show origin/main:docs/openapi.json > /tmp/openapi.main.json
- run: npx oasdiff breaking /tmp/openapi.main.json docs/openapi.json --fail-on ERR
```

- **Additive changes** (new endpoint, new optional field, new enum value the client tolerates)
  pass freely — this is the expand side of expand/contract.
- **Breaking changes** (remove/rename/retype a field, change a status code, tighten a request)
  fail the gate. The two legitimate exits: rework the change to be additive, or ship it under a
  **new URI version** (`/v2` beside `/v1` — the hexagonal set's versioning), keeping `/v1` until
  every pinned consumer has migrated. Overriding the gate (label/flag) is a release decision
  with a paper trail, not a default.
- The monorepo made oasdiff optional review-signal (03 §2); the polyrepo promotes it to a
  **required** gate — it is the only thing standing between a merged BE PR and a consumer that
  finds out at runtime.

## 4. Drift Notification — pinned ≠ stale-forever

Pinning makes the FE immune to surprise, not to rot. Close the loop so "the pin is N commits
behind" is a visible fact, not an archaeology find:

- **Push**: a BE CI step on merge to main, when `docs/openapi.json` changed, fires
  `repository_dispatch` to the FE repo. The FE workflow compares `.contract-version` to BE main,
  runs `oasdiff` between the pinned and current spec, and opens/updates a single
  "contract ahead" issue listing the delta (breaking vs additive).
- **Pull** (no cross-repo tokens available): the same comparison as a weekly scheduled job in
  the FE repo.

Either way the FE decides *when* to take the upgrade — the mechanism only guarantees it decides
with eyes open.

## 5. Runtime Verification Across the Seam

The monorepo proves integration by construction; the polyrepo should prove it by test. The
pragmatic ladder, cheapest first:

1. **FE e2e against a pinned BE image**: BE CI publishes a container per main commit; the FE's
   Playwright suite (init-react 09) runs against `ghcr.io/<org>/<be>:<sha-from-.contract-version>`
   via docker compose — the FE tests against exactly the API version it claims to target.
2. **Consumer-driven contracts (Pact)** only when multiple consumers with independent cadences
   make per-consumer compatibility claims worth their setup cost. Below that, the oasdiff gate +
   pinned-image e2e cover the same risk for a fraction of the ceremony.

## 6. Harness Binding Deltas

Each repo keeps its own stack harness (13-harness-engineering.md) — there is no merged root
binding (04) in the polyrepo. Add to the slots:

| Slot | BE repo adds | FE repo adds |
| --- | --- | --- |
| `GATE_COMMANDS_IN_ORDER` | `openapi:check` + oasdiff breaking gate | `contract:check` = generate:api + git diff (against the pin) |
| `STACK_INVARIANTS` | "breaking API change ⇒ new URI version or reworked additive" | "openapi.json and .contract-version change ONLY together, via contract:pull" |
| `EXTRA_CHECKLIST` | — | "contract-ahead issue reviewed this session (if open)" |

## 7. Smells

- `openapi.json` in the FE repo updated with **no `.contract-version` diff** — a hand copy;
  the pin now lies about what the client was generated from.
- The FE pulling from BE **main/latest** in CI instead of the pinned SHA — untracked drift; you
  rebuilt "two repos that disagree" with extra steps.
- A breaking oasdiff finding merged on the BE with no new URI version and no consumer sign-off —
  the gate exists precisely for this PR.
- The contract-ahead issue open for weeks with the pin untouched — pinning has decayed into
  abandonment; schedule the upgrade or dispute the change.
- Building the npm contract package, Pact broker, or per-consumer compatibility matrix for a
  **single** consumer — polyrepo ceremony without polyrepo cardinality.
- Both repos touched in every feature, every week — you are paying polyrepo tax on monorepo
  work; RETROFIT (00) is the fix, not more pipeline.

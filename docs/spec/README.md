# docs/spec — vendored `init-*` prompt sets (spec, not code)

Seven reusable prompt sets copied **verbatim** from the `knowledge-system` repo (`prompts/`). They
are *specification an AI coding agent reads* — never runnable code, never product documentation.
Product intent for THIS repo lives outside this folder:
[`../SRS-dress-rental.md`](../SRS-dress-rental.md), [`../SRS-qr-url.md`](../SRS-qr-url.md),
[`../design/README.md`](../design/README.md).

Routing rule: **read a set's `README.md` first and open only the numbered file its File Map sends
you to.** Never bulk-read a set folder — that is how a session burns its context.

## Sync provenance

| Field | Value |
| --- | --- |
| Source | `knowledge-system` repo → `prompts/` |
| Version | **2026.10.30** (top entry of upstream `prompts/CHANGELOG.md`) |
| Synced at | **2026-10-30**, ALL seven sets from upstream commit `518495c` (*feat(prompts): human control plane + ledger tool from the dress-rental run*) via `git archive` — a committed state, not a working tree. `518495c` is on upstream branch `feat/prompts-human-control` ([knowledge-system#1](https://github.com/bangnk2000/knowledge-system/pull/1)), **not yet merged**: if that PR is amended before merge, re-sync from the merged commit |
| Upstream chain in this sync | `1b1c8af` (monorepo mode for init-nextjs — the 2026-09-24 working-tree edits, now committed) → `518495c` (human control plane, ledger tool, handoff rotation, Lite Path) |
| Previous syncs | 2026-08-09 `815fa0f` (five sets) + 2026-09-24 `init-nextjs`/`init-monorepo-contract` from the upstream working tree on top of `8c86def`; 2026-07-31 (landed `b219f3a`) from the working tree before `e3878d7` |
| Integrity | [`SHA256SUMS`](./SHA256SUMS), generated AFTER the link rewrites; CI job `harness` runs `sha256sum -c` — any local edit to vendored spec is red |
| Local deltas | ONE kind — the link rewrites in [Upstream-only docs](#upstream-only-docs) (ddd-* docs, and `stack-set-template.md` in `init-nextjs/README.md`). Everything else is byte-identical to upstream. |

## The seven sets

| Set | Authoritative for | Entry file |
| --- | --- | --- |
| [init-monorepo-contract/](./init-monorepo-contract/README.md) | This repo's shape: pnpm workspace, one-way OpenAPI contract, CI drift gates, root-harness binding | [README.md](./init-monorepo-contract/README.md) → `00-system-prompt.md` |
| [init-nestjs-hexagonal/](./init-nestjs-hexagonal/README.md) | Everything INSIDE `apps/be` | [README.md](./init-nestjs-hexagonal/README.md) |
| [init-react/](./init-react/README.md) | Everything INSIDE `apps/fe` **and** `apps/qr-admin` (two independent React workspaces, same set) | [README.md](./init-react/README.md) |
| [init-nextjs/](./init-nextjs/README.md) | Everything INSIDE `apps/web` (the public Next.js site), entered through its README §Usage Flow 1b + `00-system-prompt.md` §Monorepo mode; repo-level defaults are overridden by [init-monorepo-contract 01 §4b](./init-monorepo-contract/01-workspace-structure.md) | [README.md](./init-nextjs/README.md) |
| [init-harness/](./init-harness/README.md) | The root session artifacts: `../../AGENTS.md`, `feature_list.json`, `init.sh`, `claude-progress.md`, `session-handoff.md`, `clean-state-checklist.md` | [README.md](./init-harness/README.md) |
| [init-feature-spec/](./init-feature-spec/README.md) | The lane UPSTREAM of code: one capability's use-case spec + outcome catalog + UI state matrix, approved before a slice is scaffolded. Outputs land in `../design/` | [README.md](./init-feature-spec/README.md) |
| [init-release/](./init-release/README.md) | The lane DOWNSTREAM of `pass`: readiness checklist, release/rollback plan, compatibility matrix. Outputs land in `docs/releases/<release-id>/`. Never deploys | [README.md](./init-release/README.md) |

Flow across the sets for one capability:

```text
init-feature-spec  →  init-nestjs-hexagonal (apps/be)  →  pnpm contract  →  init-react (apps/fe | apps/qr-admin)
                                                                         └→ init-nextjs (apps/web)
      (spec)                     └──────────── init-harness records the entry ────────────┘
                                                                                  └─→ init-release (when shipping)
```

## Upstream-only docs

The prompt sets reference four DDD workflow documents that live **only** in the upstream repo
(`knowledge-system/docs/design/`): `ddd-feature-delivery-workflow.md`, `ddd-workflow-artifacts.md`,
`ddd-project-lifecycle.md`, `ddd-placeorder-example.md`. They are generic workflow theory plus a
worked `PlaceOrder` example — reusable knowledge, not this product's design — so they are **not
vendored here**, and neither is upstream's `stack-set-template.md` (an authoring guide for new
stack sets, irrelevant to a repo that only consumes them).

Consequently the eight ddd links that pointed at `../../docs/design/ddd-*.md` upstream now point at
this section instead. Their link text still names the upstream file: read it in the
`knowledge-system` repo. The one `../stack-set-template.md` link in `init-nextjs/README.md` is rewritten the same way. This is the ONLY local edit to the vendored files.

## Re-sync procedure

Run from a Linux shell (GNU `sed`). Vendor a **committed** upstream state — never a working tree
(upstream `prompts/README.md` §Versioning):

```bash
REV=<upstream commit>                       # e.g. the merge commit of the upstream PR
DR=<path-to>/dress-rental/docs/spec
TMP=$(mktemp -d); (cd <path-to>/knowledge-system && git archive "$REV" prompts) | tar -x -C "$TMP"
KS=$TMP/prompts
for s in init-harness init-monorepo-contract init-nestjs-hexagonal init-react init-nextjs \
         init-feature-spec init-release; do rm -rf "$DR/$s"; cp -r "$KS/$s" "$DR/$s"; done
# re-apply the local link delta
grep -rl '\.\./\.\./docs/design/' "$DR" | xargs -r sed -i \
  's|](\.\./\.\./docs/design/ddd-[a-z-]*\.md)|](../README.md\#upstream-only-docs)|g'
sed -i 's|](\.\./stack-set-template\.md)|](../README.md\#upstream-only-docs)|g' "$DR/init-nextjs/README.md"
rm -rf "$TMP"
# integrity: hash AFTER the rewrites (this README is local, so it is excluded)
(cd "$DR" && find . -name '*.md' ! -path ./README.md -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
```

Then, in the same commit:

1. update **Sync provenance** above (version + date + commit + upstream chain);
2. re-read the diff for rules that changed tier (SHOULD → MUST) and record every gap the new spec
   opens for this repo as a numbered entry in `apps/be/AGENTS.md` / `apps/fe/AGENTS.md`
   §Deviations — a spec rule this repo does not follow is either a **deliberate deviation** (with
   its reason and migration path) or a **GAP to close**, never silence;
3. re-sync the Current state section of the root [`AGENTS.md`](../../AGENTS.md).

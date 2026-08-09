# docs/spec — vendored `init-*` prompt sets (spec, not code)

Six reusable prompt sets copied **verbatim** from the `knowledge-system` repo (`prompts/`). They
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
| Synced at | **2026-08-09**, upstream commit `815fa0f` (*fix(prompts): implementation pass — make the example layer match the policy layer*) |
| Upstream chain in this sync | `e3878d7` (full L1–L2 coverage: new spec/release sets, outcome-through-boundary, stack template) → `27b417d` (consistency pass) → `815fa0f` (implementation pass) |
| Previous sync | 2026-07-31, landed 2026-08-04 in `b219f3a` — taken from the upstream **working tree** just before `e3878d7`, which is why those files matched no upstream commit |
| Local deltas | ONE — the link rewrite in [Upstream-only docs](#upstream-only-docs). Everything else is byte-identical to upstream. |

## The six sets

| Set | Authoritative for | Entry file |
| --- | --- | --- |
| [init-monorepo-contract/](./init-monorepo-contract/README.md) | This repo's shape: pnpm workspace, one-way OpenAPI contract, CI drift gates, root-harness binding | [README.md](./init-monorepo-contract/README.md) → `00-system-prompt.md` |
| [init-nestjs-hexagonal/](./init-nestjs-hexagonal/README.md) | Everything INSIDE `apps/be` | [README.md](./init-nestjs-hexagonal/README.md) |
| [init-react/](./init-react/README.md) | Everything INSIDE `apps/fe` **and** `apps/qr-admin` (two independent React workspaces, same set) | [README.md](./init-react/README.md) |
| [init-harness/](./init-harness/README.md) | The root session artifacts: `../../AGENTS.md`, `feature_list.json`, `init.sh`, `claude-progress.md`, `session-handoff.md`, `clean-state-checklist.md` | [README.md](./init-harness/README.md) |
| [init-feature-spec/](./init-feature-spec/README.md) | The lane UPSTREAM of code: one capability's use-case spec + outcome catalog + UI state matrix, approved before a slice is scaffolded. Outputs land in `../design/` | [README.md](./init-feature-spec/README.md) |
| [init-release/](./init-release/README.md) | The lane DOWNSTREAM of `pass`: readiness checklist, release/rollback plan, compatibility matrix. Outputs land in `docs/releases/<release-id>/`. Never deploys | [README.md](./init-release/README.md) |

Flow across the sets for one capability:

```text
init-feature-spec  →  init-nestjs-hexagonal (apps/be)  →  pnpm contract  →  init-react (apps/fe | apps/qr-admin)
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

Consequently the eight links that pointed at `../../docs/design/ddd-*.md` upstream now point at
this section instead. Their link text still names the upstream file: read it in the
`knowledge-system` repo. This is the ONLY local edit to the vendored files.

## Re-sync procedure

```bash
KS=<path-to>/knowledge-system/prompts
DR=<path-to>/dress-rental/docs/spec
for s in init-harness init-monorepo-contract init-nestjs-hexagonal init-react \
         init-feature-spec init-release; do rm -rf "$DR/$s"; cp -r "$KS/$s" "$DR/$s"; done
# re-apply the single local delta
grep -rl '\.\./\.\./docs/design/' "$DR" | xargs -r sed -i \
  's|](\.\./\.\./docs/design/ddd-[a-z-]*\.md)|](../README.md\#upstream-only-docs)|g'
```

Then, in the same commit:

1. update **Sync provenance** above (date + commit + upstream chain);
2. re-read the diff for rules that changed tier (SHOULD → MUST) and record every gap the new spec
   opens for this repo as a numbered entry in `apps/be/AGENTS.md` / `apps/fe/AGENTS.md`
   §Deviations — a spec rule this repo does not follow is either a **deliberate deviation** (with
   its reason and migration path) or a **GAP to close**, never silence;
3. re-sync the Current state section of the root [`AGENTS.md`](../../AGENTS.md).

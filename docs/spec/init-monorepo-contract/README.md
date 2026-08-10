# Prompt Set: Full-Stack Monorepo with a Generated Contract (NestJS ↔ React)

This folder is a **reusable prompt set** that welds the two stack sets —
[`../init-nestjs-hexagonal/`](../init-nestjs-hexagonal/README.md) (backend) and
[`../init-react/`](../init-react/README.md) (frontend) — into **one pnpm workspace with one
generated OpenAPI contract**, so the backend and frontend structurally cannot drift:

```
apps/be source (DTOs + decorators)     ← the ONLY thing a human edits
        │  pnpm openapi:emit
        ▼
packages/contract/openapi.json         ← generated, committed, never hand-edited
        │  pnpm generate:api
        ▼
apps/fe/src/api/generated/             ← generated, committed, never hand-edited
```

One feature = one PR that carries the BE change, the regenerated contract, and the regenerated
FE client **together** — CI rejects any PR where the three are not in sync (03). When the two
sides genuinely cannot share a repo, the same one-way contract runs across two repos with
pinning + a breaking-change gate replacing that atomicity — that is
[05-polyrepo-variant.md](./05-polyrepo-variant.md), and it is strictly more machinery: default
to the monorepo.

These are spec/prompt documents — not runnable code. This set does NOT restate either stack's
architecture: each app keeps its own set's rules verbatim. It only owns what emerges from
putting them in one repo: workspace layout, the contract pipeline, drift gates, ship-together
runtime, and the single merged harness.

## When to Use / Not Use

| Situation | Verdict |
| --- | --- |
| One product, one team (or solo), NestJS API + React SPA | **Use this set** (00–04) |
| BE and FE owned by separate teams with separate release trains, or the repos are already split and merging is off the table | **Use [05-polyrepo-variant.md](./05-polyrepo-variant.md)**: pinned contract + `contract:pull` + oasdiff breaking gate + drift notification |
| Multiple frontends consuming one API | Still fits — add `apps/` entries; the contract stays the single source |
| Backend is not the OpenAPI source of truth (3rd-party API) | Out of scope — use init-react alone with its §6 fallback |

## File Map

| File | What it covers | When to read |
| --- | --- | --- |
| [README.md](./README.md) | This index: purpose, usage flow, composition rules | Start here / orientation |
| [00-system-prompt.md](./00-system-prompt.md) | Master prompt: CREATE a contract monorepo (or RETROFIT two existing repos) | Feed first, always |
| [01-workspace-structure.md](./01-workspace-structure.md) | pnpm workspace layout, root scripts, version floors, deltas vs the stack sets' defaults | When laying out the repo |
| [02-contract-pipeline.md](./02-contract-pipeline.md) | The offline `openapi:emit` script, Orval wiring, BE spec-quality discipline + the per-feature rhythm (spec-first step 0 → BE → emit → FE) | When wiring or debugging the pipeline |
| [03-ci-and-runtime.md](./03-ci-and-runtime.md) | The three drift gates in CI, ship-together deploy (one artifact, no version skew) | When setting up CI/CD |
| [04-harness-binding.md](./04-harness-binding.md) | The ONE root harness binding (merges both stack bindings per [init-harness 05](../init-harness/05-composition-contract.md)) | When creating the session harness |
| [05-polyrepo-variant.md](./05-polyrepo-variant.md) | The same contract across TWO repos: pinned `openapi.json` + `.contract-version`, `contract:pull`, oasdiff breaking gate, drift notification, pinned-image e2e | Only when BE and FE cannot share a repo |

## Usage Flow — Bootstrap a New Full-Stack Product

Order matters: the contract must exist before the FE data layer can be generated.

1. **Skeleton.** Feed [00-system-prompt.md](./00-system-prompt.md) (Mode: CREATE) with the
   product idea. The agent generates the workspace per 01 (root files, `packages/contract/`,
   CI per 03, root harness per 04) — apps still empty. Approve the plan first.
2. **Backend.** Inside `apps/be/`, run the normal init-nestjs-hexagonal bootstrap
   (its Scenario 1 kickoff), plus the 02 deltas (emit script, `openapi:emit` npm script).
   Gate: `pnpm openapi:emit` produces a spec with ≥ 1 real tagged module.
3. **Contract.** `pnpm contract` at root → `openapi.json` + `apps/fe/src/api/generated/` exist.
4. **Frontend.** Inside `apps/fe/`, run the normal init-react bootstrap, pointing its Orval
   input at `../../packages/contract/openapi.json` (01 §deltas). The FE starts from a REAL
   contract, never a guessed one.
5. **Prove it.** `bash init.sh` at root — the merged harness (04) runs the contract gates plus
   both apps' own gates from a clean checkout.

Grow the product per feature with each stack's own scaffold prompt; the per-feature rhythm and
its gates live in [02 §5](./02-contract-pipeline.md) and [04](./04-harness-binding.md).

## Composition & Precedence

- Each stack set stays **authoritative inside its app folder**. This set never overrides a
  layer rule; where a stack default conflicts with monorepo reality (paths, spec sync), the
  delta is listed explicitly in [01 §4](./01-workspace-structure.md) — those deltas win.
- **One repo = one harness** ([init-harness 05 §5.2](../init-harness/05-composition-contract.md)).
  The two apps' `13-harness-engineering.md` bindings are NOT instantiated separately; their slot
  values are merged into the single root binding in [04](./04-harness-binding.md).
- The contract pipeline is one-way. "FE needs a field" is ALWAYS a BE change first — never a
  hand-edit to `openapi.json` or the generated client, not even "temporarily". Which fields and
  outcomes exist is decided upstream in the approved use-case spec
  ([02 §5 step 0](./02-contract-pipeline.md)) — the pipeline owns the artifact direction, not
  the semantics.

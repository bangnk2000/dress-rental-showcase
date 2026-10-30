# Composition Contract — Binding This Set to Any `init-*`

This file makes `init-harness` composable: a **binding** is a small set of slot values a stack
init supplies; everything else in this set stays invariant. Both existing prompt sets already
ship full bindings as their `13-harness-engineering.md` — this contract is the generalization,
so any future init gets one the same way.

## 5.1 The Slots

A binding MUST fill these seven slots:

| Slot | Meaning | Example (generic) |
| --- | --- | --- |
| `GATE_COMMANDS_IN_ORDER` | The verification gates, exact and ordered | `pnpm build && pnpm lint && pnpm test` |
| `INSTALL_CMD` | Deterministic install | `pnpm install --frozen-lockfile` |
| `UNIT_OF_WORK` | What one `feature_list.json` entry is + its `id` convention | "vertical slice; id = `<context>/<use-case>`" |
| `RUNTIME_PROOF` | What counts as runtime evidence for this stack | "endpoint exercised against running app: status codes + DB row + event observed" |
| `SCAFFOLD` | Deterministic generation command, or `none` | `pnpm plop slice -- --context <c> --name <n>` |
| `STACK_INVARIANTS` | The 3–7 rules `AGENTS.md` must carry inline | "no inner→outer imports; SDK only in adapters" |
| `DOCS_POINTERS` | Where deep facts live (the stack init's own files, `docs/`) | `docs/spec/00-system-prompt.md`, `docs/design/README.md` |

Optional slots: `RUNTIME_SETUP` (DB up, migrations, codegen drift check for `init.sh`),
`EXTRA_CHECKLIST` (stack lines for `clean-state-checklist.md`), `BENCHMARKS` (budgeted perf
gates), `OWNERSHIP_BOUNDARIES` (multi-agent partitioning), `DESIGN_TEMPLATE` (the stack's
design-doc template + what counts as design-tier, per [06-design-first.md](./06-design-first.md);
both current stack sets ship it as `14-design-first.md`), `TRUTH_DOCS` (the generated inventory /
contract files and their `*:check` CI gates).

Human-control slots ([07-human-control.md](./07-human-control.md)), optional but filled at
CREATE by asking or inferring: `ID_PATTERN` (the regex form of `UNIT_OF_WORK`'s id convention,
for [`ledger.mjs`](./08-ledger-tool.md)), `CODE_OWNER`, `REQUIRED_CHECKS` (the CI job names
branch protection must require), `AGENT_TRAILER`, `MIGRATIONS_DIR` / `CONTRACT_DIR` (CODEOWNERS
paths), `HANDOFF_KEEP` (handoff entries kept before rotation, default 5), `LEDGER_CHECK_CMD` /
`LEDGER_SUMMARY_CMD` (default `node scripts/ledger.mjs check` / `summary`; non-Node repos name
their port, 08 §8.4).

## 5.2 Precedence Rules

When `init-harness` and a stack init are loaded together:

1. **The stack init owns slot VALUES** (the concrete what/how). Never re-derive a gate the
   binding already names.
2. **`init-harness` owns lifecycle INVARIANTS** (the when/whether): one active feature,
   evidence-before-pass, state-in-files, repair-baseline-first, clean exit, plan-before-files.
   A binding may tighten these, never loosen them.
3. **A full binding file wins over this set's templates** where they overlap — it is the
   specialized edition of [02](./02-artifacts-and-templates.md)+[03](./03-session-loop.md). Use
   this set for what the binding doesn't cover (audit machinery, sizing tiers, smells).
4. One repo = one harness. A full-stack product (e.g. NestJS API + React SPA) runs one binding
   per repo, same shape — never two harnesses in one repo.

## 5.3 Existing Bindings (worked examples)

### A — `init-nestjs-hexagonal` → [13-harness-engineering.md](../init-nestjs-hexagonal/13-harness-engineering.md)

| Slot | Value |
| --- | --- |
| `GATE_COMMANDS_IN_ORDER` | `pnpm build` → `pnpm lint && pnpm arch` → `pnpm test` → `pnpm migrate` (fresh DB) → `pnpm test:e2e` |
| `INSTALL_CMD` | `pnpm install --frozen-lockfile` |
| `UNIT_OF_WORK` | use-case slice; id `<context>/<use-case>` (+ cross-cutting `infra/*` entries) |
| `RUNTIME_PROOF` | endpoint exercised on the compose stack: status codes, persisted row, domain event observed |
| `SCAFFOLD` | `pnpm plop slice -- --context <ctx> --name <verb-noun>` |
| `STACK_INVARIANTS` | inward deps only; no cross-module imports; SDK only in `*.adapter.ts`; Result-vs-throw |
| `DOCS_POINTERS` | `docs/spec/00-system-prompt.md` (entry file; 01–14 reached from it) + `docs/design/README.md` (design index) + `docs/ARCHITECTURE.md` (enterprise tier) |
| `DESIGN_TEMPLATE` (opt.) | [`14-design-first.md`](../init-nestjs-hexagonal/14-design-first.md): context design doc + invariant-enforcement table; design-tier = new context/aggregate/invariant/contract |

### B — `init-react` → [13-harness-engineering.md](../init-react/13-harness-engineering.md)

| Slot | Value |
| --- | --- |
| `GATE_COMMANDS_IN_ORDER` | `pnpm check` → `pnpm lint && pnpm arch` → `pnpm test` → `pnpm build` (+ codegen drift: `pnpm generate:api && git diff --exit-code src/api/generated`) |
| `INSTALL_CMD` | `pnpm install --frozen-lockfile` |
| `UNIT_OF_WORK` | feature route/slice; kebab-case id == `features/<id>/` |
| `RUNTIME_PROOF` | behavior exercised in `pnpm dev` / `pnpm preview`: three states render (data/empty/error); PWA update prompt if touched |
| `SCAFFOLD` | feature scaffold per `10-feature-scaffold-prompt.md` |
| `STACK_INVARIANTS` | no cross-feature imports; generated API code untouched by hand; app/ boundaries |
| `DOCS_POINTERS` | `docs/spec/00-system-prompt.md` of `init-react` (entry file) + `docs/design/README.md` (design index) |
| `DESIGN_TEMPLATE` (opt.) | [`14-design-first.md`](../init-react/14-design-first.md): bootstrap brief + slice design doc (UX flow, URL state, data/invalidation map) + UI Foundation; design-tier = new interaction/navigation pattern |

## 5.4 Binding Template — for the NEXT init

When creating or composing with an init that has no binding, derive one and save it INTO that
init (as `NN-harness-engineering.md` or a `## Harness Binding` section in its README):

```markdown
# Harness Binding — <init-name>
Binds [../init-harness/](../init-harness/) to this stack. Slot values below are authoritative;
lifecycle invariants come from init-harness and are not restated here.

| Slot | Value |
| --- | --- |
| GATE_COMMANDS_IN_ORDER | <exact commands, ordered> |
| INSTALL_CMD            | <command> |
| UNIT_OF_WORK           | <what one feature is; id convention> |
| RUNTIME_PROOF          | <what must be observed at runtime> |
| SCAFFOLD               | <command or none> |
| STACK_INVARIANTS       | <3–7 rules AGENTS.md carries inline> |
| DOCS_POINTERS          | <entry files — README/index, never bare folders> |
| (optional) RUNTIME_SETUP / EXTRA_CHECKLIST / BENCHMARKS / OWNERSHIP_BOUNDARIES | … |

## Notes
<anything stack-specific the six artifacts must add — extra init.sh steps, checklist lines,
evidence examples in this stack's vocabulary>
```

Sanity rule for any new binding: every slot value must be **executable or observable** — if a
reviewer can't run it or watch it happen, it's not a slot value, it's a wish.

## 5.5 Kickoff Prompt for a Composed Bootstrap

```text
You are bootstrapping with TWO prompt sets:
- docs/spec/<stack-init>/ — the architecture spec (primary; its 00-system-prompt.md is yours).
- docs/spec/init-harness/ — the session harness (00-system-prompt.md, Mode: CREATE).
Slot values come from the stack init's harness binding (13-harness-engineering.md or §5.3-style
table). Generate the architecture scaffold AND the six harness artifacts in the same plan;
init.sh must run the stack init's gates. Show the combined plan and STOP for approval.
```

# Harness Binding — init-monorepo-contract

Binds [../init-harness/](../init-harness/) to the contract monorepo. Slot values below are
authoritative; lifecycle invariants come from init-harness and are not restated here.

This binding **merges and replaces** the two per-app bindings
(`init-nestjs-hexagonal/13-harness-engineering.md`, `init-react/13-harness-engineering.md`):
one repo = one harness ([05-composition-contract §5.2.4](../init-harness/05-composition-contract.md)).
The six artifacts (`AGENTS.md`, `feature_list.json`, `init.sh`, progress, handoff, checklist)
live at the **repo root**, never inside `apps/*`. Where a slot value below says "per stack
binding", the app-level detail (e.g. what BE runtime proof looks like) still comes from that
binding's text — read as reference, not instantiated as a second harness.

| Slot | Value |
| --- | --- |
| `GATE_COMMANDS_IN_ORDER` | `pnpm contract:check` → `pnpm check` → `pnpm lint && pnpm arch` → `pnpm test` → `pnpm --filter be test:e2e` (compose stack, per BE binding) → `pnpm --filter fe build` |
| `INSTALL_CMD` | `pnpm install --frozen-lockfile` (root, once — one lockfile) |
| `UNIT_OF_WORK` | one product feature **across the contract**: id `<context>/<use-case>` (BE convention); its FE surface is `features/<kebab-id>` and is part of the SAME entry, not a second one. Single-side work gets prefix `be:` / `fe:` |
| `RUNTIME_PROOF` | both sides against the SAME running stack: endpoint proof per BE binding (status codes + persisted row + event) AND the FE flow on `pnpm --filter fe dev` proxied to that stack (three states render). Evidence cites both |
| `SCAFFOLD` | BE: `pnpm --filter be plop slice -- --context <c> --name <n>` → `pnpm contract` → FE: per `init-react/10-feature-scaffold-prompt.md`. The `pnpm contract` step between them is part of the scaffold, not optional glue |
| `STACK_INVARIANTS` | (1) contract is one-way: BE source → `openapi.json` → generated client; neither artifact hand-edited EVER; (2) BE: inward deps only, SDK only in adapters (per BE set); (3) FE: no cross-feature imports, server state only in query cache (per FE set); (4) cross-app sharing only through `packages/*`; (5) FE/BE ship as one unit |
| `DOCS_POINTERS` | `docs/spec/init-monorepo-contract/` (this set) · `docs/spec/init-nestjs-hexagonal/` (inside `apps/be` work) · `docs/spec/init-react/` (inside `apps/fe` work) |
| `RUNTIME_SETUP` (optional) | `init.sh`: compose up DB → `pnpm --filter be migrate` → `pnpm contract:check` as the FIRST verification after install — a stale contract invalidates everything downstream |
| `EXTRA_CHECKLIST` (optional) | clean-state additions: "no diff under `packages/contract` or `apps/fe/src/api/generated` you didn't intend"; "if BE DTOs changed this session, contract + client diffs are in the same commit" |

## Notes

- **`feature_list.json` evidence for a cross-contract feature** names three commits-worth of
  proof in one entry: BE gate output, the contract diff hash (or "contract unchanged"), FE gate
  output + runtime proof. An entry claiming "pass" with only one side's evidence is the
  monorepo's version of the evidence-before-done violation.
- **`init.sh` order:** install → contract freshness (`pnpm contract:check`) → `pnpm check` →
  lint/arch → tests → BE e2e if the compose stack is available (degrade with a WARN, per
  init-harness sizing) → fe build. Contract freshness comes first because every later gate
  trusts the generated layer.
- **Session scope discipline:** a session may touch both apps ONLY when it is the same
  feature's slice-pair (UNIT_OF_WORK above). "While I'm here" edits to the other app are the
  scope smell init-harness 03 already bans — the monorepo makes them easier to commit, so the
  root `AGENTS.md` must carry the rule inline.

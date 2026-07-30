# Artifacts & Templates — the Six Files

Generic templates with `{{slots}}`. When composing with a stack init, fill slots from its
binding ([05-composition-contract.md](./05-composition-contract.md)); standalone, fill them from
repo inspection. Adapted from `harness-creator/templates/`, normalized to one status vocabulary.

## 2.1 `AGENTS.md` (Instructions) — routing + invariants only

```markdown
# {{PROJECT_NAME}} — Agent Instructions

{{ONE_PARAGRAPH_PURPOSE}}

## Startup (in order)
1. Read this file completely.
2. Read `session-handoff.md` (previous session context), if present.
3. Read `feature_list.json` — current state; ONE feature in progress at a time.
4. Run `bash init.sh` on a fresh clone or resumed session. If baseline verification fails,
   repair that FIRST — do not add scope on a broken baseline.
5. Review `git log --oneline -5`.

## Working Rules
- One feature at a time, picked from `feature_list.json`.
- Stay in scope: don't touch files unrelated to the active feature.
- Verification before "done": run {{GATE_COMMANDS}} — all green.
- {{STACK_INVARIANTS}}   <!-- e.g. layer rules, import bans; owned by the stack init -->

## Definition of Done
See `clean-state-checklist.md`. Short form: behavior implemented, gates green,
runtime-verified ({{RUNTIME_PROOF}}), evidence recorded, repo restartable via `bash init.sh`.

## End of Session
1. Update `feature_list.json` (status + evidence + timestamp).
2. Append to `progress.md`; rewrite `session-handoff.md`.
3. Re-sync the `Current state` section of this file (if present) to the repo as-committed.
4. Run `clean-state-checklist.md`; commit when the tree is safe.

## Where Deep Facts Live
- Architecture: {{DOCS_POINTERS}}   <!-- entry FILES (README/index), never bare folders -->
- Scaffolding: {{SCAFFOLD_COMMAND_OR_NONE}}
```

`CLAUDE.md` may simply be this file or `@AGENTS.md`-include it; if both exist, one is the source
and the other points at it — never two diverging copies.

`{{DOCS_POINTERS}}` values are concrete entry FILES — a doc set's README/index that carries a
file map — never bare folders. "Read `docs/<set>/`" invites bulk-reading an entire set into
context every session; the entry file orients cheaply and routes to the one detail file the
task actually needs. Same rule for any pointer this template emits: cite `file.md §section`,
not a directory.

An optional `## Current state` section (3–6 lines: what exists, what is next) helps orientation,
but it is part of the baton: **re-sync it at every session end**, exactly like the handoff. A
stale current-state actively misroutes the next session — it reads "apps not bootstrapped yet"
and re-plans work that already shipped. If it will not be maintained, omit it and point at
`session-handoff.md` instead.

## 2.2 `feature_list.json` (State) — the ledger

Status vocabulary (normalize upstream's `not-started` → `todo`):
`todo | in-progress | pass | fail | blocked`.

```jsonc
{
  "project": "{{PROJECT_NAME}}",
  "description": "{{ONE_LINE}}",
  "features": [
    {
      "id": "{{UNIT_OF_WORK_ID}}",        // convention owned by the stack binding
      "name": "{{HUMAN_NAME}}",
      "description": "{{BEHAVIOR + DONE CRITERIA, concrete enough to verify}}",
      "dependencies": [],                  // ids that must pass first
      "status": "todo",
      "evidence": "",                      // REQUIRED non-empty for pass/fail: commands run + behavior observed
      "testedAt": null                     // ISO timestamp when status last verified
    }
  ]
}
```

Rules:
- Every capability the repo promises has an entry — features AND cross-cutting ones (config
  validation, CI pipeline, auth wiring).
- Max ONE `in-progress`. `fail`/`blocked` entries name the failing command or blocker.
- `evidence` names what was **run** and what was **observed** ("`pnpm test` 12 green; `POST
  /invoices` → 201 + DB row"). "Build passes" is not evidence for an endpoint.
- Cheap CI lint (valid JSON, one in-progress, evidence non-empty for `pass`) catches ledger rot.

## 2.3 `init.sh` (Verification) — every resume starts here

Explicit commands for THIS repo — the stack-detection cascade in the upstream template is for
bootstrap only; replace it with named gates once known.

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[1/N] install"        && {{INSTALL_CMD}}
echo "[2/N] gates"          && {{GATE_COMMANDS_IN_ORDER}}
echo "[3/N] runtime deps"   && {{RUNTIME_SETUP_OR_SKIP}}   # DB up, migrations from zero, codegen drift check…
echo "[N/N] harness files present"
for f in AGENTS.md feature_list.json progress.md session-handoff.md clean-state-checklist.md; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
done
echo "Init OK. {{HOW_TO_LAUNCH}}"
```

Properties: idempotent, read-only (verifies, never mutates beyond install/codegen), fails loudly,
runnable by human or agent with identical results. If a tier defers a gate to CI, print that
("e2e: CI-only") instead of omitting it silently.

## 2.4 `progress.md` (State) — append-only session log

One block per session; the history, not the current state:

```markdown
## {{DATE}} — session {{N}}
- Goal:
- Done: (with evidence pointers)
- Decisions: (and WHY — the next session must not relitigate)
- Issues / numbers: (failures hit, benchmark results)
```

## 2.5 `session-handoff.md` (Lifecycle) — the baton

Rewritten at session END, read at next session START. The *current* state — keep it short, all
sections present even when "None":

```markdown
# Session Handoff — {{DATE}}
## Objective & status        (goal, branch/commit, % feel)
## Completed this session    (bullet per feature, evidence pointer)
## Next concrete steps       (smallest-first)
## Decisions made            (and why)
## Files modified            (paths, one line each)
## Blockers / risks          (or "None")
```

## 2.6 `clean-state-checklist.md` (Lifecycle) — end-of-session gate

```markdown
## Verification
- [ ] {{GATE_COMMANDS}} all pass (or deferred-to-CI stated explicitly)
- [ ] Runtime proof for changed behavior: {{RUNTIME_PROOF}}
## Repository
- [ ] No unintended/stray files staged; no secrets; generated code in sync
- [ ] feature_list.json reflects REALITY (status + evidence + testedAt)
- [ ] progress.md appended; session-handoff.md rewritten
- [ ] AGENTS.md `Current state` (if present) matches the repo as-committed
- [ ] Committed with a descriptive message once the tree is safe
```

Keep it under ~15 boxes — a checklist that gets skipped protects nothing
([01-five-subsystems.md](./01-five-subsystems.md) §4).

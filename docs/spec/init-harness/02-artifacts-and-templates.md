# Artifacts & Templates — the Six Files

Plus, from bootstrap, `scripts/ledger.mjs` ([08](./08-ledger-tool.md)) and the human-control
files ([07](./07-human-control.md) §7.1: `CODEOWNERS`, PR template).

Generic templates with `{{slots}}`. When composing with a stack init, fill slots from its
binding ([05-composition-contract.md](./05-composition-contract.md)); standalone, fill them from
repo inspection. Adapted from `harness-creator/templates/`, normalized to one status vocabulary.

## 2.1 `AGENTS.md` (Instructions) — routing + invariants only

```markdown
# {{PROJECT_NAME}} — Agent Instructions

{{ONE_PARAGRAPH_PURPOSE}}

## Startup (in order)
1. Read this file completely.
2. Read the FIRST entry of `session-handoff.md` (previous session context), if present.
3. {{LEDGER_SUMMARY_CMD}} — current state; ONE feature in progress at a time. Never open the
   whole `feature_list.json` once it outgrows a cheap read; `show <id>` prints one entry.
   <!-- Node repos: `node scripts/ledger.mjs summary` (08). Others: the port or `jq` subset (08 §8.4),
        or "read feature_list.json" while it is small. -->

4. Run `bash init.sh` on a fresh clone or resumed session. If baseline verification fails,
   repair that FIRST — do not add scope on a broken baseline.
5. Review `git log --oneline -5`.

## Working Rules
- One feature at a time, picked from `feature_list.json`.
- Stay in scope: don't touch files unrelated to the active feature.
- Verification before "done": run {{GATE_COMMANDS}} — all green.
- {{STACK_INVARIANTS}}   <!-- e.g. layer rules, import bans; owned by the stack init -->
- Every business rule you choose without the owner's decision is an `ownerPending` item on the
  ledger entry — never only a sentence in the handoff ([07](./07-human-control.md) §7.3).
- Agent-authored commits carry `{{AGENT_TRAILER}}`; PRs fill the template's control facts (07 §7.5).

## Definition of Done
See `clean-state-checklist.md`. Short form: behavior implemented, gates green,
runtime-verified ({{RUNTIME_PROOF}}), evidence recorded, repo restartable via `bash init.sh`.

## End of Session
1. Update `feature_list.json` (status + evidence + timestamp).
2. Append to `progress.md`; prepend one `session-handoff.md` entry and rotate (§2.5).
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
      "id": "{{UNIT_OF_WORK_ID}}",        // convention owned by the stack binding; ID_PATTERN lints it
      "title": "{{HUMAN_NAME}}",           // (legacy ledgers: "name" — readers accept both)
      "description": "{{BEHAVIOR + DONE CRITERIA + REQUIREMENT ID, concrete enough to verify}}",
      "tier": "standard",                  // mechanical | standard | design (06 §6.3) — marks a strict entry
      "designDoc": null,                   // required for tier "design": path to its approved doc
      "dependencies": [],                  // ids that must pass first
      "acceptance": [],                    // optional: acceptance criteria ids/text; when present,
                                           // evidence names which AC each command proved
      "status": "todo",
      "evidence": "",                      // REQUIRED non-empty for pass/fail: commands run + behavior observed
      "testedAt": null,                    // ISO date when status last verified
      "pr": null,                          // optional: PR/MR reference once opened
      "ownerPending": [],                  // optional: [{ "item": "<decision, §ref>", "since": "YYYY-MM-DD" }] (07 §7.3)
      "deploy": null                       // optional, set at pass: { "order": [...], "migration": bool, "deployed": null } (07 §7.4)
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
- When `acceptance` is filled, evidence references the ACs it proves ("AC3: duplicate submit →
  one order, `Idempotency-Replayed` header observed") — that line IS the traceability link
  `acceptance criterion → test → evidence`.
- `pass` is the ledger's terminal state; "ready for release → released" is owned by a release
  workflow (e.g. the [init-release](../init-release/README.md) set), which reads this ledger
  as its evidence source.
- **Status lives ONLY here.** Other docs (SRS traceability tables, design indexes, READMEs)
  link the ledger `id`; they never carry their own status column. A second copy of status is
  stale by the next session — `ledger.mjs stale-status <md…>` finds the rows that already are.
- Lint and read it with [`scripts/ledger.mjs`](./08-ledger-tool.md) (`check` in CI and as the
  first line of `init.sh`; `summary`/`show` instead of opening the file). The strict fields
  (`tier`, `description`, `designDoc`, id pattern) are enforced only on entries carrying `tier`,
  so adopting this schema never fails an existing ledger — and never backfill old entries.

## 2.3 `init.sh` (Verification) — every resume starts here

Explicit commands for THIS repo — the stack-detection cascade in the upstream template is for
bootstrap only; replace it with named gates once known.

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[0/N] ledger"         && {{LEDGER_CHECK_CMD}}       # `node scripts/ledger.mjs check`, or its port / jq subset (08 §8.4)
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

**Newest first, rotated.** At session END prepend ONE entry; at START read ONLY the first entry.
Keep at most `{{HANDOFF_KEEP}}` entries (default 5): move the oldest, **verbatim**, to the top of
`docs/harness/session-handoff-archive.md` (history only, never read on resume; fix its relative
links for the new location). Entries are never edited after the session that wrote them — moving
one to the archive is not editing it.

Why not "rewrite one current-state file": a single rewritten file loses the previous session's
watch-outs the moment the next session overwrites it, and an append-only file grows until the
resume read costs more than the work. Prepend + rotate keeps both the history and a cheap resume
(first donor: 49 sessions, resume read stays ~8 lines).

```markdown
# Session Handoff
Newest first. On resume read ONLY the first entry. Close: prepend one entry, keep ≤ {{HANDOFF_KEEP}},
move the oldest verbatim to docs/harness/session-handoff-archive.md.

## {{DATE}} ({{N}}) — {{one-line outcome}} (`{{feature-id}}` = {{status}})
- Done: (per feature, with commit/PR)
- Proof: (the commands + observations — detail lives in the ledger evidence)
- Next: (smallest-first; deploy order if something passed but is not live)
- Watch out: (traps the next session would otherwise hit; "None" if none)
```

≤ ~8 lines per entry. Decisions waiting on the owner go in the ledger's `ownerPending`
(07 §7.3), not only here — `Next` may point at them, never be their only home.

## 2.6 `clean-state-checklist.md` (Lifecycle) — end-of-session gate

```markdown
## Verification
- [ ] {{GATE_COMMANDS}} all pass (or deferred-to-CI stated explicitly)
- [ ] Runtime proof for changed behavior: {{RUNTIME_PROOF}}
## Repository
- [ ] No unintended/stray files staged; no secrets; generated code in sync
- [ ] {{LEDGER_CHECK_CMD}} green; feature_list.json reflects REALITY (status + evidence
      + testedAt; `ownerPending` holds every rule chosen without the owner; `deploy` set on a pass)
- [ ] progress.md appended; one session-handoff.md entry prepended, oldest rotated to the archive
- [ ] AGENTS.md `Current state` (if present) matches the repo as-committed
- [ ] Committed with a descriptive message once the tree is safe
```

Keep it under ~15 boxes — a checklist that gets skipped protects nothing
([01-five-subsystems.md](./01-five-subsystems.md) §4).

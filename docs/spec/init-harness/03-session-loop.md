# The Session Loop — Startup, Scope, Done, Exit

This file specifies how a session actually runs inside the harness. It is stack-agnostic; the
concrete commands come from the binding's slots
([05-composition-contract.md](./05-composition-contract.md)).

## 3.1 The Loop

```
START  → read AGENTS.md → session-handoff.md → feature_list.json → bash init.sh
WORK   → pick THE ONE in-progress feature (or promote exactly one todo)
       → design gate: if the feature is design-tier (06-design-first.md), its design doc
         exists and is approved BEFORE implementation starts
       → implement inside scope; run the gates continuously, not just at the end
       → verify at runtime ({{RUNTIME_PROOF}})
FINISH → feature_list.json: status + evidence + testedAt
       → progress.md: append session block
       → session-handoff.md: rewrite
       → AGENTS.md: re-sync `Current state` (if present)
       → clean-state-checklist.md: pass → commit
```

The guarantee this loop buys: **the session can be interrupted at any point and the next session
(same agent, different agent, or a human) resumes losslessly.** That is the harness's entire job.

## 3.2 Startup Rules

- `init.sh` failing means the baseline is broken: **repair first, add scope never.** A feature
  built on a red baseline produces unverifiable evidence.
- If `session-handoff.md` contradicts `feature_list.json`, trust the feature list (it carries
  evidence) and note the drift in `progress.md`.
- No handoff file + non-empty history? Reconstruct a handoff from `git log` and the feature list
  before working — do not guess.

## 3.3 Scope Rules (anti-overreach)

- Exactly ONE feature `in-progress`. Promoting a second one requires demoting the first to
  `todo`/`blocked` with a note.
- Touch only files the active feature needs. Drive-by refactors become `todo` entries, not edits.
- A discovered prerequisite becomes a `dependencies` entry and its own feature — the current
  feature goes `blocked`, not silently bigger.

## 3.4 Definition of Done (anti-"declared victory")

A feature moves to `pass` only when ALL hold:

1. The target behavior is implemented — not scaffolded, not "mostly".
2. Every gate command ran and is green: `{{GATE_COMMANDS_IN_ORDER}}`.
3. **Runtime verification**: the behavior was exercised in the running system and observed —
   `{{RUNTIME_PROOF}}` (an endpoint returns its status codes; a UI renders its states; a CLI
   processes real input). Compiling is not running.
4. New behavior has tests at the level the binding demands; changed persistence/codegen verified
   from zero (fresh DB migration, clean regeneration diff).
5. `feature_list.json` updated: `pass` + evidence naming commands AND observations + `testedAt`.
6. Docs touched if behavior or commands changed (`AGENTS.md` if the rules changed). For a
   design-tier feature, the design doc got its as-built re-sync note
   ([06-design-first.md](./06-design-first.md) §6.4).
7. `clean-state-checklist.md` passes.

`fail` and `blocked` are honest states — record the failing command or blocker and move on;
never leave a feature `in-progress` across a session boundary without saying so in the handoff.

## 3.5 End-of-Session Routine (the baton pass)

1. `feature_list.json` — statuses reflect reality, evidence updated.
2. `progress.md` — append the session block (goal, done, decisions + why, issues).
3. `session-handoff.md` — rewrite for the next session: smallest-first next steps.
4. `AGENTS.md` — re-sync its `Current state` section (if present): it must describe the repo
   as-committed. A stale current-state misroutes the next session, which reads AGENTS.md before
   anything else in the startup order.
5. `clean-state-checklist.md` — run it; fix or explicitly defer (stated, not silent).
6. Commit with a descriptive message once the tree is safe. Uncommitted work at session end is a
   dropped baton unless the handoff says exactly what is uncommitted and why.

## 3.6 Multi-Agent Note

The one-feature rule is per **ownership boundary**. Parallel agents are safe only when the
harness declares boundaries (one agent per bounded context / package / directory) and each
boundary keeps its own single `in-progress` feature. Shared files (`feature_list.json`,
handoff) get one writer per boundary or a merge rule — say which in `AGENTS.md`.

# The Five Subsystems — Core Model, Design Rules, Sizing

A capable agent with a weak harness forgets context between sessions, drifts out of scope,
claims "done" before anything runs, and leaves the repo in a state the next session can't
resume. The harness fixes this with five subsystems. Every artifact this prompt set generates
belongs to exactly one of them.

## 1. The Model

| Subsystem | Minimal artifact(s) | Purpose | Failure it prevents |
| --- | --- | --- | --- |
| **Instructions** | `AGENTS.md` / `CLAUDE.md` | Startup path, working rules, Definition of Done | Inconsistent starts, reinvented conventions |
| **State** | `feature_list.json`, `progress.md` | Which feature is active, what passed, with what evidence | Context loss, relitigated decisions |
| **Verification** | `init.sh` + explicit gate commands | What the agent MUST run before claiming done | "Done" that doesn't run |
| **Scope** | Feature `description` + done criteria; ONE in progress | One feature at a time, no overreach | Half-finished sprawl |
| **Lifecycle** | `session-handoff.md`, `clean-state-checklist.md` | Clean exit; next session restartable | Dropped baton between sessions |

The subsystems are load-bearing **together**: state without verification is fiction; verification
without lifecycle rots by the third session; instructions that don't route to the state files are
furniture.

## 2. Design Rules

From the upstream `harness-creator` skill, kept verbatim in spirit:

- **Root instruction file = routing + invariants, not a manual.** Deep facts live in `docs/` and
  the stack's own spec. Target ≤ 150 lines; an agent must be able to re-read it every session.
- **Project facts live in project docs, not in the harness.** The harness points; it does not
  duplicate.
- **Verification commands are explicit and runnable.** "Run the tests" is not a command;
  `pnpm test` is.
- **Evidence before "done".** A status change without observed behavior is fiction.
- **One active feature** unless the harness defines explicit multi-agent ownership boundaries
  (e.g. one agent per bounded context / package).
- **Append/update state files; never rely on chat history as memory.**
- **Never hide destructive behavior in scripts.** Overwrites, resets, and deletions require
  explicit user approval; `init.sh` verifies, it does not mutate.

## 3. Sizing Tiers

The fullest harness is a ceiling, not a mandate. Match the tier to the work, and say which tier
you chose.

| Tier | When | Artifacts |
| --- | --- | --- |
| **Minimal** | Solo repo, short tasks, single session at a time | `AGENTS.md`, `feature_list.json`, `init.sh`, `progress.md` |
| **Multi-session** | Work spans sessions or agents hand off | + `session-handoff.md`, `clean-state-checklist.md` |
| **Enterprise** | Team + CI, long-running product | + `docs/ARCHITECTURE.md` routing, CI lint of `feature_list.json`, benchmark/cleanup scripts, evaluator rubric |

Scale DOWN honestly: if a tier omits a gate (e.g. e2e runs only in CI), the harness says so
explicitly rather than silently dropping it.

## 4. Harness Smells (self-check)

Generate harnesses that don't exhibit these; flag them in every audit:

- `feature_list.json` says `pass` with empty or boilerplate evidence; or two features
  `in-progress`.
- `init.sh` green locally while CI runs different commands (gate drift).
- `session-handoff.md` stale by more than one session — the baton was dropped.
- Checklists so long they get skipped — prune to what actually catches regressions.
- Progress notes living in chat instead of files; rules "remembered" instead of added to
  `AGENTS.md`.
- A gate that cannot fail (benchmark without budgets, checklist nobody runs) — decoration, not
  verification.
- Evidence citing only compile/lint for behavior-shaped work (runtime proof missing).
- Harness files present but `AGENTS.md` doesn't route to them — presence without a startup path.
- Instruction file grown into a manual (> ~150 lines of prose) — agents skim it, then ignore it.

# Audit Checklist — Scoring an Existing Harness

AUDIT-mode procedure. Read-only: no file writes, no unsolicited rewrites. Modeled on the
upstream `validate-harness.mjs` + `tools/audit-harness.sh` checks, expressed as prompts.

## 4.1 Checks

Run every check; classify CRITICAL (harness doesn't function without it) vs RECOMMENDED
(reliability upgrade).

### Instructions
- [ ] **CRITICAL** — An instruction file exists (`AGENTS.md` / `CLAUDE.md` / equivalent).
- [ ] **CRITICAL** — It contains an ordered startup path that routes to the state files and
      `init.sh` (presence without routing = furniture).
- [ ] **CRITICAL** — Verification commands are named explicitly (no "run the tests").
- [ ] REC — ≤ ~150 lines; deep facts pointed to, not duplicated.
- [ ] REC — If both `AGENTS.md` and `CLAUDE.md` exist, one sources the other (no divergence).
- [ ] REC — If it carries a `Current state` section, that section matches ledger/git reality
      (no more than one session stale).

### State
- [ ] **CRITICAL** — A feature/state ledger exists (`feature_list.json` or equivalent) and is
      valid (parseable, statuses in vocabulary).
- [ ] **CRITICAL** — At most ONE feature `in-progress`.
- [ ] **CRITICAL** — Every `pass` has non-empty evidence naming commands + observations.
- [ ] REC — A progress log exists and its last entry matches recent `git log`.
- [ ] REC — Status lives only in the ledger: no other doc (SRS traceability, design index,
      README) carries a status column that disagrees with it — run
      `node scripts/ledger.mjs stale-status <docs>` ([08](./08-ledger-tool.md)) or diff by hand.
- [ ] REC — Human-facing docs (root README, design index) name every app/area that exists and
      no release/state that is no longer true. Agents keep `AGENTS.md` fresh; these rot unseen.

### Verification
- [ ] **CRITICAL** — `init.sh` (or documented equivalent) exists and exits non-zero on failure.
- [ ] **CRITICAL** — Running it from a clean state actually passes (execute it if permitted;
      otherwise mark "unverified" — never assume).
- [ ] REC — Gates match CI (no local/CI drift).
- [ ] REC — Runtime proof is defined for behavior-shaped work, not just compile/lint.

### Scope
- [ ] **CRITICAL** — Feature entries carry concrete done criteria (verifiable descriptions).
- [ ] REC — Dependencies between features are recorded; blocked items name their blocker.
- [ ] REC — Design gate honored: design-tier features reference an `approved` design doc via
      the scaffold input's `useCaseSpec` pointer, the feature description, or evidence
      (06-design-first.md); tier inflation (design-shaped work labeled standard/mechanical to
      dodge the doc) is flagged as a finding.

### Lifecycle
- [ ] REC — `session-handoff.md` exists, newest entry first, no more than one session stale,
      rotated (≤ the kept count; older entries in the archive, verbatim) — 02 §2.5.
- [ ] REC — A clean-state checklist exists, short enough to actually run (≤ ~15 boxes).
- [ ] REC — Last sessions ended with the routine (ledger + log + handoff updated in the same
      commit window).

### Human control ([07-human-control.md](./07-human-control.md)) — scored as a sixth row
- [ ] REC — `CODEOWNERS` covers harness files, design/ADR/SRS docs, vendored spec, migrations,
      contract, CI config (07 §7.1).
- [ ] REC — Default branch requires a PR + the CI checks (inspect the forge settings, or mark
      "unverified" — never assume).
- [ ] REC — PR template carries the control facts (tier, requirement, design state, owner
      decisions, deploy order) and recent PRs actually filled it.
- [ ] REC — Agent-authored commits are distinguishable (`git log --grep '<trailer>'`).
- [ ] REC — Every design doc is in one of the four approval states (07 §7.3); no `as-built` doc
      whose rules line says "not yet"; every `agent-default` doc has `ownerPending` items.
- [ ] REC — `ledger.mjs pending` agrees with reality: no owner question only in the handoff, no
      deploy only in an external runbook, no release record written after the fact without
      saying so.

## 4.2 Scoring

Score each subsystem 1–5 with a one-line justification. The five subsystems measure whether
agents can work reliably; **Human control** measures whether the owner can govern that work —
a repo can score 5 on the first five and 2 on the sixth, and that gap is the usual finding:

| Score | Meaning |
| --- | --- |
| 5 | All checks pass; evidence trail spot-checked and real |
| 4 | CRITICALs pass; minor REC gaps |
| 3 | Functions, but a CRITICAL is weak (e.g. evidence is boilerplate) |
| 2 | Subsystem exists but agents can't rely on it |
| 1 | Absent or decorative |

## 4.3 Report Format (exact)

```markdown
## Harness Audit — {{repo}} ({{date}})
| Subsystem | Score | Why (one line) |
| --- | --- | --- |
| Instructions | n/5 | … |
| State | n/5 | … |
| Verification | n/5 | … |
| Scope | n/5 | … |
| Lifecycle | n/5 | … |
| Human control | n/5 | … |

**Bottleneck:** {{lowest subsystem}} — treat as CANDIDATE cause; confirm against real failures
(logs, session outcomes) before claiming causality.

**First fixes (smallest first):**
1. {{file}} — {{change}} — {{failure it prevents}}
2. …
3. …
```

Cap the fix list at 3. A 20-item audit report is itself a harness smell — the point is the next
action, not the inventory. Cross-check anything suspicious against the smells list in
[01-five-subsystems.md](./01-five-subsystems.md) §4.

## 4.4 Shell Alternative

For a human-runnable second opinion (zero dependencies):

```bash
curl -fsSL https://raw.githubusercontent.com/walkinglabs/learn-harness-engineering/main/tools/audit-harness.sh | bash -s -- /path/to/repo
```

Exit 0 = all CRITICALs pass. Its findings and this checklist should agree; where they differ,
trust whichever was actually executed against the repo.

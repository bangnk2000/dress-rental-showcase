# Harness Engineering — the Project's Operating System for Agents

A capable agent with a weak harness forgets context between sessions, drifts out of scope, claims
"done" before anything runs, and leaves the repo in a state the next session can't resume. This
file specifies the **harness**: the artifact files and scripts that give every session the same
startup path, verifiable state, and a clean exit. `08-ai-agent-first.md` owns the *rules and
enforcement* (AGENTS.md content, ESLint boundaries); this file owns the *session lifecycle and
evidence system* around them.

Model and artifact set adapted from
[walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering)
(capstone `projects/project-06/solution` + the `harness-creator` skill), specialized for this
React SPA stack. The stack-agnostic, standalone edition is [`../init-harness/`](../init-harness/)
— this file is its **React binding** (slot values per
[`../init-harness/05-composition-contract.md`](../init-harness/05-composition-contract.md) §5.3B).

## 1. The Five Subsystems

Every useful coding-agent harness has five subsystems. Keep each artifact small enough that agents
actually read it every session.

| Subsystem | Artifact(s) | Purpose |
| --- | --- | --- |
| **Instructions** | `AGENTS.md`, `CLAUDE.md` (see `08-ai-agent-first.md` §1–2) | Startup path, working rules, Definition of Done |
| **State** | `feature_list.json`, `claude-progress.md` | Which feature is active, what passed, with what evidence |
| **Verification** | `init.sh`, the `pnpm check/lint/arch/test/build` gates | Commands the agent MUST run before claiming done |
| **Scope** | feature entries' `description` + done criteria; ONE feature in progress | Prevents overreach and half-finished work |
| **Lifecycle** | `session-handoff.md`, `clean-state-checklist.md` | Makes the next session restartable |

Design rules (from the upstream skill, kept verbatim in spirit):
- Root instruction file = routing + invariants, not a manual; deep facts live in `docs/` and this
  prompt set.
- Verification commands are explicit and runnable — no "run the tests" without the command.
- **Evidence before "done"** — a status change without observed behavior is fiction.
- One active feature at a time (unless the harness defines multi-agent ownership boundaries).
- Append/update state FILES; never rely on chat history as memory.

## 2. `feature_list.json` — the state ledger

Seeded from the Features & Routes table of the `00-system-prompt.md` output; updated by every task.

```jsonc
{
  "project": "<name>",
  "description": "<one line>",
  "features": [
    {
      "id": "invoices",                       // kebab-case, == features/<id>/ when it's a slice
      "name": "Invoices — list + create",
      "description": "Authenticated /invoices route: suspense list, validated create form, invalidation",
      "status": "pass",                       // todo | in-progress | pass | fail | blocked
      "evidence": "pnpm check/lint/arch/test green (4 slice tests). Verified in pnpm dev: anonymous redirected; create → toast + list refresh; empty state on fresh account.",
      "testedAt": "2026-07-06T00:00:00Z"
    }
  ]
}
```

Rules:
- **Every product capability has an entry** — features, but also cross-cutting capabilities the
  scaffold promises (auth session + guards, i18n switching, PWA update prompt, offline shell).
- `evidence` names **what was run and what was observed** (commands + runtime behavior). "Build
  passes" is not evidence for a route; a screenshot-level description of behavior is.
- Status moves `todo → in-progress` when work starts (max ONE `in-progress`), and to `pass` only
  after the Definition of Done (§3). `fail`/`blocked` entries carry the failing command/blocker in
  `evidence`.
- CI may lint the file (valid JSON, schema, ONE in-progress) — cheap and catches ledger rot.

## 3. Definition of Done (the anti-"declared victory" gate)

A feature is "done" when ALL of:

1. `pnpm check` — TypeScript compiles, zero errors.
2. `pnpm lint && pnpm arch` — boundaries, naming, generated-code purity all green.
3. `pnpm test` — the slice's tests exist and pass (happy/empty/error/validation minimum,
   `09-testing-strategy.md` §4).
4. **Runtime verification** — the behavior was exercised in the running app (`pnpm dev`, or
   `pnpm preview` for PWA behavior) and the three states render. UI work is not done at
   "compiles".
5. `feature_list.json` updated with status `pass` + evidence + timestamp.
6. Docs touched if behavior/architecture changed (`docs/` at Enterprise tier; AGENTS.md if
   commands/rules changed).
7. `clean-state-checklist.md` passes (§6).

## 4. Session lifecycle artifacts

### `init.sh` — verification on every resume (Verification subsystem)

Run after cloning and when resuming work. Fails loudly; exit 1 on any missing gate.

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[1/6] pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile
echo "[2/6] API layer freshness"
pnpm generate:api && git diff --exit-code src/api/generated openapi.json
echo "[3/6] typecheck + lint + arch"
pnpm check && pnpm lint && pnpm arch
echo "[4/6] tests"
pnpm test
echo "[5/6] build"
pnpm build
echo "[6/6] harness files present"
for f in AGENTS.md CLAUDE.md feature_list.json session-handoff.md \
         claude-progress.md clean-state-checklist.md scripts/check-architecture.sh; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
done
echo "Init OK. pnpm dev to launch."
```

### `session-handoff.md` — the baton (Lifecycle)

Updated at the END of every session; read at the START of the next (AGENTS.md startup step 2).
Sections, all required even when short:

```markdown
# Session Handoff
## Last session: <date>
### What was accomplished        (bullet per capability, with evidence pointers)
### What remains                 (next concrete steps, smallest-first)
### Decisions made               (and WHY — the next session must not relitigate)
### Files modified               (paths, one line each)
### Blockers                     (or "None")
```

### `claude-progress.md` — the session log (State)

Append-only, one block per session: date, goal, what was done, decisions, issues, benchmark
numbers if run. The handoff is the *current* state; the progress log is the *history* — don't
merge them.

## 5. Scripts — observability, boundaries, cleanup

### `scripts/check-architecture.sh` (Required — wired as `pnpm arch`)

Belt-and-braces greps that survive ESLint misconfiguration (`08-ai-agent-first.md` §3c). Exit 1 on
any violation; each check prints PASS/VIOLATION per file:

1. **Generated purity**: `pnpm generate:api && git diff --exit-code src/api/generated openapi.json`.
2. **HTTP door**: `grep -rE "from ['\"]axios" src --include='*.ts*' | grep -v '^src/api/'` → empty.
3. **Kernel purity**: `grep -rE "from ['\"]@/features/" src/components src/lib src/hooks` → empty.
4. **Ring privacy**: `grep -rE "from ['\"]@/app/" src | grep -v '^src/app/'` → empty; cross-feature
   deep imports (`@/features/<a>/` referenced from `features/<b>`) → empty.
5. **Tailwind v4 idioms**: no `tailwind.config.{js,ts,cjs}` exists; `grep -r "@tailwind " src` → empty.
6. **Locale parity**: key sets of `public/locales/en/*.json` match every other language (node
   one-liner or i18next-parser).
7. **Token hygiene**: `grep -rE "localStorage.*[tT]oken" src | grep -v features/auth` → empty.

### `scripts/benchmark.sh` (Prod-only)

Performance is measured, not assumed; budgets fail CI. For an SPA the meaningful suite is:

- **Bundle budget**: total gzip JS of `dist/assets/*.js` under a stated budget (e.g. 300 KB
  initial); print per-chunk sizes; fail over budget.
- **Lighthouse** against `pnpm preview` (`@lhci/cli` or `lighthouse --preset`): performance ≥ 90,
  PWA pass (when in scope) — record scores in `quality-document.md`.
- **Test-suite duration** (guards against a rotting suite: fail if unit suite exceeds a threshold).

Write results into the session log so regressions have a paper trail.

### `scripts/cleanup-scanner.sh` (Optional)

Stale-artifact detection, run before major testing cycles and at session end:

- Dead exports / unused files (`knip` or `ts-prune`).
- Unused locale keys (keys present in JSON, absent in `t()` calls) and the reverse.
- Orphan assets in `public/` referenced nowhere; leftover `*.test.tsx.snap`s; `devOptions.enabled:
  true` in vite config; `console.log` in `src/` outside a logger wrapper.

## 6. `clean-state-checklist.md` — end-of-session gate

Adapted to this stack; run before committing and at session end:

```markdown
## Build
- [ ] pnpm check / lint / arch / test / build all pass
## Architecture
- [ ] git status shows NO diff under src/api/generated (or only regeneration paired with openapi.json)
- [ ] No cross-feature or app/ imports introduced (pnpm arch confirms)
## Runtime
- [ ] pnpm dev: app boots clean (no console errors), changed routes render all three states
- [ ] Auth: anonymous redirect + sign-in + sign-out (with cache clear) still work if touched
- [ ] Language switch works for changed namespaces; no raw keys visible in the UI
- [ ] PWA (if in scope, and if touched): pnpm build && pnpm preview → update prompt + offline shell
## Repository
- [ ] No unintended files staged; no .env or secrets; no dist/ committed
- [ ] feature_list.json reflects actual status (evidence updated)
- [ ] claude-progress.md appended; session-handoff.md updated if the session is ending
```

## 7. `docs/` hierarchy + quality tracking (Enterprise tier)

- `docs/ARCHITECTURE.md` — rings diagram, data flow (spec → Orval → hooks → cache → UI), auth
  flow, PWA caching map. Update BEFORE code when architecture changes.
- `docs/PRODUCT.md` — features and user-facing behavior (the prose version of feature_list.json).
- `docs/RELIABILITY.md` — error-handling policy, query defaults, offline behavior, benchmark
  budgets, and how to read them.
- `evaluator-rubric.md` + `quality-document.md` — periodic scored review: one row per feature
  (1–5) and per harness file (present/complete), plus benchmark evidence. Their job is honesty:
  scores must cite the checklist/benchmark runs that justify them, so "quality" is a measurement,
  not a vibe.

## 8. How a session actually runs (the loop)

```
START  → read AGENTS.md → session-handoff.md → feature_list.json → bash init.sh
WORK   → pick THE ONE in-progress (or promote one todo) → build inside the rings
       → run the gates continuously (check/lint/arch/test), verify at runtime
FINISH → feature_list.json evidence → claude-progress.md append → session-handoff.md rewrite
       → clean-state-checklist.md pass → commit
```

An agent that follows this loop can be interrupted at any point and the next session (same agent,
different agent, or a human) resumes losslessly — that is the harness's entire job.

## 9. Smells — harness self-check

- `feature_list.json` says "pass" with empty/boilerplate evidence, or two features in-progress.
- `init.sh` green locally but CI runs different commands (drift between §4 and `08` §3d).
- session-handoff.md stale by more than one session (the baton was dropped).
- Checklists growing so long they're skipped — prune to what actually catches regressions.
- Progress notes living in chat instead of the files; a rule "remembered" instead of added to
  AGENTS.md.
- Benchmark script exists but budgets never fail (a gate that can't fail is decoration).
- Harness files present but AGENTS.md doesn't route to them — presence without the startup path
  is furniture.

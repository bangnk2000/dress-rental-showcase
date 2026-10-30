# Harness Engineering — the Project's Operating System for Agents

A capable agent with a weak harness forgets context between sessions, drifts out of scope, claims
"done" before anything runs, and leaves the repo in a state the next session can't resume. This
file specifies the **harness**: the artifact files and scripts that give every session the same
startup path, verifiable state, and a clean exit. `08-ai-agent-first.md` owns the *rules and
enforcement* (AGENTS.md/CLAUDE.md content, dependency-cruiser, eslint boundaries, plop); this file
owns the *session lifecycle and evidence system* around them. Together they are the project's
operating system for agents.

Model and artifact set adapted from
[walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering)
(capstone `projects/project-06/solution` + the `harness-creator` skill), specialized for this
NestJS hexagonal backend. The frontend sibling is
[`../init-react/13-harness-engineering.md`](../init-react/13-harness-engineering.md) — a full-stack
product runs one harness per repo, same shape. The stack-agnostic, standalone edition is
[`../init-harness/`](../init-harness/) — this file is its **NestJS binding** (slot values per
[`../init-harness/05-composition-contract.md`](../init-harness/05-composition-contract.md) §5.3A).

## 1. The Five Subsystems

Every useful coding-agent harness has five subsystems. Keep each artifact small enough that agents
actually read it every session.

| Subsystem | Artifact(s) | Purpose |
| --- | --- | --- |
| **Instructions** | `AGENTS.md`, `CLAUDE.md` (templates in `08-ai-agent-first.md` A.2–A.3) | Startup path, working rules, Definition of Done |
| **State** | `feature_list.json`, `claude-progress.md` | Which use case is active, what passed, with what evidence |
| **Verification** | `init.sh`, the `pnpm build/lint/arch/test/test:e2e` gates | Commands the agent MUST run before claiming done |
| **Scope** | feature entries' `description` + done criteria; ONE slice in progress | Prevents overreach and half-finished work |
| **Lifecycle** | `session-handoff.md`, `clean-state-checklist.md` | Makes the next session restartable |

Design rules (from the upstream skill, kept verbatim in spirit):
- Root instruction file = routing + invariants, not a manual; deep facts live in `docs/` and this
  prompt set.
- Verification commands are explicit and runnable — no "run the tests" without the command.
- **Evidence before "done"** — a status change without observed behavior is fiction.
- One active slice at a time (unless the harness defines multi-agent ownership boundaries, e.g.
  one agent per bounded context).
- Append/update state FILES; never rely on chat history as memory.

Add these startup steps to `AGENTS.md` (they extend the A.2 template):

```markdown
## Startup (in order)
1. Read this file, then `session-handoff.md` (previous session context).
2. Read `feature_list.json` — current slice status; ONE slice in progress at a time.
3. Run `bash init.sh` if this is a fresh clone / resumed session (verifies toolchain + build + DB).
```

## 2. `feature_list.json` — the state ledger

The unit of tracking is the **use-case slice** (`modules/<context>/commands|queries/<use-case>/`),
plus cross-cutting capabilities the scaffold promises. Seeded from the Bounded Contexts table of
the `00-system-prompt.md` output (section 2: each command/query use case becomes an entry).

```jsonc
{
  "project": "<name>",
  "description": "<one line>",
  "features": [
    {
      "id": "billing/create-invoice",          // <context>/<use-case>
      "title": "Create invoice (command)",
      "description": "POST /invoices: Invoice aggregate with Money VO, invariants amount>0 + draft start, InvoiceCreated event",
      "status": "pass",                        // todo | in-progress | pass | fail | blocked
      "evidence": "pnpm build/lint/arch green; create-invoice.service.spec.ts 5 cases (Ok + 2 Err paths); e2e: POST /invoices → 201 + row in DB, duplicate → 422 { status: 'rejected_duplicate_invoice' }; event handler fired (log assert).",
      "testedAt": "2026-07-06T00:00:00Z"
    },
    {
      "id": "infra/exception-filter",
      "title": "Global exception filter",
      "description": "Thrown technical exceptions map to HTTP; Result errors untouched",
      "status": "pass",
      "evidence": "e2e asserts outcome bodies (status codes) + envelope codes (error.code); unit test for filter",
      "testedAt": "2026-07-05T00:00:00Z"
    }
  ]
}
```

Rules:
- **Every use-case slice has an entry**; so do cross-cutting capabilities (config validation,
  exception filter, migrations pipeline, the `ai-agent` context's conversation loop).
- `evidence` names **what was run and what was observed** (commands + behavior: status codes,
  DB rows, emitted events). "Build passes" is not evidence for an endpoint.
- Status moves `todo → in-progress` when work starts (max ONE `in-progress`), and to `pass` only
  after the Definition of Done (§3). `fail`/`blocked` entries carry the failing command/blocker.
- CI may lint the file (valid JSON, ONE in-progress) — cheap and catches ledger rot.

## 3. Definition of Done (the anti-"declared victory" gate)

A use-case slice is "done" when ALL of:

1. `pnpm build` — compiles, zero errors.
2. `pnpm lint && pnpm arch` — boundaries, naming, dependency-cruiser all green (no inner→outer,
   no cross-module, no SDK in domain).
3. `pnpm test` — the slice's unit spec exists and passes (Ok path + every declared `Err` path,
   `09-testing-strategy.md`); integration test if the repository/mapper changed.
4. **Runtime verification** — the endpoint was exercised against the running app
   (`docker-compose up` + real HTTP call or the e2e suite): correct status codes, row persisted,
   domain event observed. A handler is not done at "compiles".
5. Migrations applied cleanly on a fresh DB (`pnpm migrate` from zero) if schema changed.
6. `feature_list.json` updated with status `pass` + evidence + timestamp.
7. Docs touched if behavior/architecture changed (`docs/` at Enterprise tier; `AGENTS.md` if
   commands/rules changed).
8. `clean-state-checklist.md` passes (§6).

## 4. Session lifecycle artifacts

### `init.sh` — verification on every resume (Verification subsystem)

Run after cloning and when resuming work. Fails loudly; exit 1 on any missing gate.

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[1/7] pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile
echo "[2/7] build"
pnpm build
echo "[3/7] lint + architecture"
pnpm lint && pnpm arch
echo "[4/7] unit + integration tests"
pnpm test
echo "[5/7] DB up + migrations from zero"
docker compose up -d db && pnpm migrate
echo "[6/7] e2e (acceptance)"
# init.sh is the resume gate from Phase 4 onward; the e2e suite only lands in Phase 8
# (12-implementation-checklist.md) — defer, don't fail, until it exists.
if [ -d tests/e2e ]; then pnpm test:e2e; else echo "e2e: deferred (Phase 8)"; fi
echo "[7/7] harness files present"
for f in AGENTS.md CLAUDE.md feature_list.json session-handoff.md \
         claude-progress.md clean-state-checklist.md .dependency-cruiser.cjs plopfile.cjs; do
  [ -f "$f" ] || { echo "MISSING: $f"; exit 1; }
done
echo "Init OK. pnpm start:dev to launch."
```

(Scale down per tier: a small service may skip step 6 locally and rely on CI — but then `init.sh`
says so explicitly rather than silently omitting it.)

### `session-handoff.md` — the baton (Lifecycle)

Updated at the END of every session; read at the START of the next. Sections, all required even
when short:

```markdown
# Session Handoff
## Last session: <date>
### What was accomplished        (bullet per slice, with evidence pointers)
### What remains                 (next concrete steps, smallest-first)
### Decisions made               (and WHY — persistence choice, VO granularity, event design;
                                  the next session must not relitigate)
### Files modified               (paths, one line each)
### Blockers                     (or "None")
```

### `claude-progress.md` — the session log (State)

Append-only, one block per session: date, goal, what was done, decisions, issues, benchmark
numbers if run. The handoff is the *current* state; the progress log is the *history* — don't
merge them.

## 5. Scripts — observability, boundaries, cleanup

### `scripts/check-architecture.sh` (Required — part of `pnpm arch`)

dependency-cruiser (`08-ai-agent-first.md` A.4) is the primary gate; this script adds
belt-and-braces greps that survive a miswired config. Exit 1 on any violation:

1. **Domain purity**: `grep -rE "from '(@nestjs|@anthropic-ai|slonik|typeorm|@prisma)" src/modules/*/domain` → empty. (Not `src/libs/ddd`: its `aggregate-root.base.ts` imports `EventEmitter2` deliberately — the one sanctioned framework seam, per 07 "framework-free where possible".) Also `grep -rE "Date\.now\(\)|crypto\.randomUUID" src/modules/*/domain` → empty.
2. **Application purity**: `grep -rE "from '.*(database|adapters)/" src/modules/*/commands src/modules/*/queries src/modules/*/application` → empty (handlers import ports, not concretes).
3. **Module privacy**: `grep -rE "from '.*modules/([a-z-]+)/" src/modules` cross-checked against the importing module → empty.
4. **SDK containment**: `grep -rl "@anthropic-ai/sdk" src | grep -v '\.adapter\.ts$'` → empty.
5. **Model ids**: `grep -rn "claude-3-" src` → empty (default must be `claude-sonnet-4-6`).
6. **Event publication**: repositories extending `SqlRepositoryBase` don't hand-roll their own
   commit path (grep for raw `pool.query` in `*.repository.ts` outside the base).

### `scripts/benchmark.sh` (Prod-only)

Performance is measured, not assumed; budgets fail CI. For an API the meaningful suite is:

- **Endpoint latency**: `autocannon` (or `oha`) against 2–3 hot endpoints on the compose stack;
  fail over stated p95 budgets; print req/s.
- **Migration time from zero** and **cold boot time** (config validation + DI graph) — both rot
  silently.
- **Test-suite duration** (fail if the unit suite exceeds a threshold — a rotting suite stops
  being run).

Write results into `claude-progress.md` so regressions have a paper trail.

### `scripts/cleanup-scanner.sh` (Optional)

Stale-artifact detection, run before major testing cycles and at session end:

- Dead exports / unused files (`knip` or `ts-prune`).
- Orphan DI tokens (token defined, never bound in a module) and unbound ports.
- Migrations not applied by the migrate script; leftover `*.spec.ts.snap`; `console.log` outside
  the logger adapter; `.env` keys absent from `.env.example` (and vice versa).

## 6. `clean-state-checklist.md` — end-of-session gate

Adapted to this stack; run before committing and at session end:

```markdown
## Build
- [ ] pnpm build / lint / arch / test pass; test:e2e pass (or CI-deferred, stated)
## Architecture
- [ ] pnpm arch: no inner→outer, no cross-module, no SDK/IO in domain or application
- [ ] New ports bound to adapters via DI tokens in the module; handlers registered
- [ ] Persistence model separate from entity; events published INSIDE the tx
## Runtime
- [ ] docker compose up + pnpm migrate from zero succeeds
- [ ] Changed endpoints exercised: expected 2xx AND the outcome bodies / envelope codes (06 §5)
- [ ] Domain events observed for changed commands (log/handler assertion)
## Repository
- [ ] No unintended files staged; no .env or secrets; migrations committed with their slice
- [ ] feature_list.json reflects actual status (evidence updated)
- [ ] claude-progress.md appended; session-handoff.md updated if the session is ending
```

## 7. `docs/` hierarchy + quality tracking (Enterprise tier)

- `docs/ARCHITECTURE.md` — the four layers, module map, data flow (controller → bus → handler →
  port → adapter), event flow (Command → Event → Command), transaction/publication rules. Update
  BEFORE code when architecture changes.
- `docs/PRODUCT.md` — bounded contexts and use cases in prose (the narrative version of
  `feature_list.json`).
- `docs/RELIABILITY.md` — error-handling policy (Result vs thrown), logging levels per layer
  (what INFO/DEBUG/WARN/ERROR mean here), migration/rollback strategy, benchmark budgets.
- `evaluator-rubric.md` + `quality-document.md` — periodic scored review: one row per context and
  per harness file (1–5 / present-complete), plus benchmark evidence. Their job is honesty: scores
  must cite the checklist/benchmark runs that justify them, so "quality" is a measurement, not a
  vibe.

## 8. How a session actually runs (the loop)

```
START  → read AGENTS.md → session-handoff.md → feature_list.json → bash init.sh
WORK   → pick THE ONE in-progress slice (or promote one todo)
       → plop the slice, fill bodies inside the layers (10-module-scaffold-prompt.md)
       → run the gates continuously (build/lint/arch/test), verify at runtime against compose
FINISH → feature_list.json evidence → claude-progress.md append → session-handoff.md prepend + rotate (init-harness 02 §2.5)
       → clean-state-checklist.md pass → commit
```

An agent that follows this loop can be interrupted at any point and the next session (same agent,
different agent, or a human) resumes losslessly — that is the harness's entire job.

## 9. Smells — harness self-check

- `feature_list.json` says "pass" with empty/boilerplate evidence, or two slices in-progress.
- `init.sh` green locally but CI runs different commands (drift between §4 and `08` A.4).
- `session-handoff.md` stale by more than one session (the baton was dropped).
- Checklists growing so long they're skipped — prune to what actually catches regressions.
- Progress notes living in chat instead of the files; a rule "remembered" instead of added to
  `AGENTS.md`.
- Benchmark script exists but budgets never fail (a gate that can't fail is decoration).
- Evidence citing only compile/lint for an endpoint-shaped slice (runtime proof missing).
- Harness files present but `AGENTS.md` doesn't route to them — presence without the startup path
  is furniture.

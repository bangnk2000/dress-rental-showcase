# Prompt Set: Initialize a Session Harness for Any Repo

This folder is a **reusable, stack-agnostic prompt set** that an AI coding agent (Claude Code,
Cursor, Codex, etc.) consumes to **create, audit, or improve a session harness** — the artifact
files and routines that make agent work reliable across sessions: consistent startup, verifiable
state, scoped work, evidence before "done", and a clean exit.

It is adapted from
[walkinglabs/learn-harness-engineering — `skills/harness-creator/`](https://github.com/walkinglabs/learn-harness-engineering/tree/main/skills/harness-creator)
and that course's five-subsystem model, converted into the prompt-set idiom of this repo
(spec documents an agent reads — not runnable code).

## Design Goals

1. **Standalone.** Works on any repository in any language — a Go CLI, a Python service, a
   legacy PHP monolith. No dependency on the other prompt sets. The agent detects the stack and
   derives verification commands, or asks for them.
2. **Composable.** Plugs into any `init-*` prompt set in this repo through an explicit
   **binding contract** ([05-composition-contract.md](./05-composition-contract.md)). The stack
   init supplies concrete values (gate commands, unit of work, runtime proof); this set supplies
   the invariant session lifecycle around them. `init-nestjs-hexagonal/13-harness-engineering.md`
   and `init-react/13-harness-engineering.md` are pre-built bindings of exactly this shape.

## File Map

| File | What it covers | When to read |
| --- | --- | --- |
| [README.md](./README.md) | This index: purpose, usage flows, composition rules | Start here / orientation |
| [00-system-prompt.md](./00-system-prompt.md) | Master prompt: CREATE / AUDIT / IMPROVE a harness in any repo | Feed first, always |
| [01-five-subsystems.md](./01-five-subsystems.md) | The core model, design rules, sizing tiers, harness smells | Before designing or judging a harness |
| [02-artifacts-and-templates.md](./02-artifacts-and-templates.md) | Generic templates: `AGENTS.md`, `feature_list.json`, `init.sh`, `progress.md`, `session-handoff.md`, `clean-state-checklist.md` | When generating the files |
| [03-session-loop.md](./03-session-loop.md) | Startup path, one-feature rule, Definition of Done, end-of-session routine | When running or specifying a session |
| [04-audit-checklist.md](./04-audit-checklist.md) | Critical/recommended checks, five-subsystem scoring, report format | When auditing an existing repo |
| [05-composition-contract.md](./05-composition-contract.md) | The binding contract: slots a stack init fills, precedence rules, worked bindings | When combining with another `init-*` set |
| [06-design-first.md](./06-design-first.md) | The design-first loop: intent vs truth docs, design tiers, the invariant rule, re-sync | Before starting any design-tier feature; when setting up `docs/design/` |

## Usage Flow 1 — Standalone: Add a Harness to Any Repo

1. Make this folder readable by the agent (copy to `docs/spec/harness/` in the target repo, or
   paste files as context).
2. Kick off:

```text
Read docs/spec/harness/00-system-prompt.md and adopt it. Mode: CREATE.
Target: this repository.
Verification commands: <list them, or write "detect">.
Generate the harness artifacts per 02-artifacts-and-templates.md, then show me the plan
(files + feature_list seed) BEFORE writing anything.
```

3. Review the plan, approve, let it write the files, then run `bash init.sh` to prove the
   harness verifies from zero.

For an existing repo you suspect already has a partial harness, use `Mode: AUDIT` first —
[04-audit-checklist.md](./04-audit-checklist.md) defines the checks and the report.

## Usage Flow 2 — Composed with Another `init-*` Set

1. Give the agent the stack init as the primary spec (e.g. `init-nestjs-hexagonal/`), this set
   alongside it.
2. If the stack init ships its own harness binding (both current sets do, as
   `13-harness-engineering.md`), **the binding is authoritative for slot values**; this set
   supplies anything the binding doesn't cover and the audit/report machinery.
3. If the stack init has **no** binding yet, have the agent derive one using the slot table and
   binding template in [05-composition-contract.md](./05-composition-contract.md), and save it
   into that init as its `13-harness-engineering.md` (or a `## Harness Binding` section).

Precedence in one line: **the stack init owns the concrete "what/how" (commands, unit of work,
proof); this set owns the invariant "when/whether" (lifecycle, evidence rules, clean exit).**

## Usage Flow 3 — Audit Only

Feed [00-system-prompt.md](./00-system-prompt.md) with `Mode: AUDIT` and
[04-audit-checklist.md](./04-audit-checklist.md). The agent returns subsystem scores (1–5),
the bottleneck, and the first 2–3 fixes — without writing files. The upstream repo also ships a
zero-dependency shell version you can run yourself:

```bash
curl -fsSL https://raw.githubusercontent.com/walkinglabs/learn-harness-engineering/main/tools/audit-harness.sh | bash -s -- /path/to/repo
```

## Relationship to the Other Prompt Sets

- [`../init-nestjs-hexagonal/13-harness-engineering.md`](../init-nestjs-hexagonal/13-harness-engineering.md)
  — the **NestJS hexagonal binding** of this set (pnpm gates, use-case-slice unit of work,
  compose-stack runtime proof).
- [`../init-react/13-harness-engineering.md`](../init-react/13-harness-engineering.md)
  — the **React SPA binding** (pnpm check/lint/arch/test/build gates, feature-route unit of work,
  dev/preview runtime proof).
- [`../init-nestjs-hexagonal/14-design-first.md`](../init-nestjs-hexagonal/14-design-first.md) and
  [`../init-react/14-design-first.md`](../init-react/14-design-first.md)
  — the stack **design templates** that fill [06-design-first.md](./06-design-first.md)'s
  `DESIGN_TEMPLATE` slot (context/aggregate design for the backend, slice + UX design for the
  frontend).
- [`../init-feature-spec/`](../init-feature-spec/README.md) — **upstream**: the capability spec
  whose acceptance criteria seed the ledger's `acceptance` field (02 §2.2).
- [`../init-release/`](../init-release/README.md) — **downstream**: reads the ledger as release
  evidence.
- Future `init-*` sets get a binding for free via the template in
  [05-composition-contract.md](./05-composition-contract.md).

## Upstream References

- [OpenAI — Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering)
  — the course; its `skills/harness-creator/scripts/` (create/validate/benchmark) are optional
  accelerators for the same artifacts this set specifies.

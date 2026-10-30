# Human Control — what the reviewer holds when agents write the code

The rest of this set makes agent work **reliable**. This file makes it **governable**: the
small set of mechanisms a human owner uses to stay in control of a repo where agents author most
commits — without reading every line of code. Written from the first donor repo, where the
harness was excellent for agents and every control gap was the same shape: the rule existed in
prose, nothing enforced it, and decisions waiting on the owner were scattered across handoff
entries.

Principle: **a rule the reviewer depends on must be either enforced by a machine or surfaced by
one command.** Prose-only rules are for agents; the reviewer gets gates and a queue.

## 7.1 The Control Plane (create at bootstrap — CREATE mode, 00)

| Mechanism | File / setting | What it buys the reviewer | Who sets it |
| --- | --- | --- | --- |
| Code owners | `.github/CODEOWNERS` (or the forge's equivalent) | Changes to the paths that encode intent and invariants cannot merge unseen | Agent writes it |
| PR template | `.github/pull_request_template.md` (§7.5) | Every PR states tier, requirement id, design state, owner decisions, deploy order — the review starts from facts, not the diff | Agent writes it |
| Branch protection | Forge setting on the default branch: PR required, `{{REQUIRED_CHECKS}}` required, no force-push | No path to `main` that skips CI or review | **Human** — an agent cannot and must not; CREATE mode prints the exact settings to apply |
| Agent attribution | Commit trailer `{{AGENT_TRAILER}}` (e.g. `Co-Authored-By: <agent> <noreply@…>`) on every agent-authored commit | `git log --grep` separates agent work from human work when everything runs under one identity | `AGENTS.md` rule |
| Owner queue | `node scripts/ledger.mjs pending` ([08](./08-ledger-tool.md)) | One command lists everything waiting on a human | Ledger fields §7.3–§7.4 |

`CODEOWNERS` minimum — the paths where an unreviewed change silently moves intent or safety:

```text
# {{CODE_OWNER}} = the human with authority over intent and release
AGENTS.md                     {{CODE_OWNER}}
feature_list.json             {{CODE_OWNER}}
docs/design/                  {{CODE_OWNER}}
docs/adr/                     {{CODE_OWNER}}
docs/SRS*                     {{CODE_OWNER}}
docs/spec/                    {{CODE_OWNER}}   # vendored — any diff is a re-sync or a mistake
{{MIGRATIONS_DIR}}            {{CODE_OWNER}}   # schema = invariants (06 §6.5)
{{CONTRACT_DIR}}              {{CODE_OWNER}}   # wire contract, when the repo has one
.github/                      {{CODE_OWNER}}   # the gates themselves
```

Solo-owner repos: most forges forbid approving your own PR, so "1 approving review" cannot be
required. Require the PR + the status checks instead, and treat merging as the review act —
the PR template (§7.5) is what makes that act informed rather than a click.

## 7.2 What the Reviewer Reviews (and what the machine already did)

The reviewer's time goes where no gate can reach. Gates own: compilation, layer rules,
contract drift, invariant proofs, ledger lint. The human owns:

1. **Intent** — the design doc / outcome catalog BEFORE code (06 §6.3). Cheapest point of control.
2. **Owner decisions** — the `ownerPending` queue (§7.3): every business default an agent chose.
3. **Tier honesty** — is "standard" really standard? (06 §6.6 tier inflation.)
4. **Go/no-go and deploy order** — never delegated ([init-release](../init-release/README.md)).

If review time is spent re-checking what a gate proves, the gate is untrusted — fix the gate.

## 7.3 Approval States — four, not two

Design docs and use-case specs carry exactly one of these in their header `Status` line, and
`ledger.mjs` reads it (08 §8.2):

| State | Meaning | Allowed next |
| --- | --- | --- |
| `draft` | Written, not reviewed | Review. A design-tier entry may NOT go `in-progress` |
| `agent-default` | The owner explicitly said "proceed" but did not decide the open rules; the agent chose defaults and LISTED them | Implement — but every default becomes an `ownerPending` item on the ledger entry, and release is blocked until they are resolved |
| `approved` | The owner decided every rule (name + date + the words used) | Implement |
| `as-built` | Approved, implemented, reconciled (06 §6.4) | — |

`agent-default` exists because the donor repo needed it and had no word for it: a spec marked
"as-built" whose rules line said "not yet — agent defaults, awaiting owner" for six weeks. Two
states hid a third; the lint could not see it. Rules for the state:

- Only on an explicit owner instruction to proceed without deciding; never self-granted.
- Each default is one `ownerPending` item: `{ "item": "<decision, §ref>", "since": "YYYY-MM-DD" }`.
- When the owner answers: remove the item, record the decision in the doc (§6 "decided by …"),
  and move the doc to `approved`/`as-built`. A changed default is new work, not an edit.

## 7.4 Deploy Facts as Data

Deploy order and migrations are the costliest thing to get wrong and were, in the donor repo,
only sentences in a handoff entry ("deploy BE FIRST, then web"; "migrate before BE restart").
Put them on the ledger entry when the feature passes:

```jsonc
"deploy": { "order": ["migrate", "be", "web"], "migration": true, "deployed": null }
// after the human deploys:                                   "deployed": "a4d32cb 2026-09-30"
```

`ledger.mjs pending` lists every `pass` whose `deploy.deployed` is empty, with its order — the
reviewer's "what is on master but not live" answer. The release lane reads the same fields.

**Out-of-band deploys.** If something is deployed outside the release lane (the owner said "ship
it now"), the next session records it the same day: `deploy.deployed` on each entry, and a
release record marked `after-the-fact` whose risks are listed as **not accepted** until the
owner accepts them by name. Never let a deploy exist only in an external runbook.

## 7.5 PR Template

```markdown
## What / why
<!-- one paragraph; the requirement id(s) this serves -->

## Control facts (reviewer reads these first)
- Ledger entry: `<id>` → status `<status>`, tier `<mechanical|standard|design>`
- Requirement: <FR-…> · Design doc: <path> — state `<draft|agent-default|approved|as-built>`
- Owner decisions still open (`ownerPending`): <none | list>
- Contract / generated code changed: <no | yes — regenerated, committed with the source>
- Migration: <no | yes — <file>, down tested on <env>>
- Deploy order: <n/a | e.g. migrate → be → web>; safe against the currently deployed peer? <yes/no + why>

## Evidence
<!-- commands run + what was observed; which AC each proved. CI link once green. -->

## Agent attribution
- [ ] Agent-authored commits carry `{{AGENT_TRAILER}}`
```

Keep it this short. A template people skip controls nothing (01 §4).

## 7.6 Smells

- The owner learns a business rule from reading code — a decision was made without `ownerPending`.
- `pending` is empty but the handoff mentions "waiting for the owner" — the queue is bypassed.
- A design doc whose header says `as-built` while its rules line says "not yet" — use `agent-default`.
- A PR touching `docs/design/` or migrations merged with no CODEOWNERS review request.
- A deploy visible in the runbook but not in `deploy.deployed`.
- Every commit authored by the owner, none with the agent trailer, in a repo the owner says
  agents mostly write — attribution is off and review cannot be targeted.

# init-release — Release Readiness and Rollout

This folder is a **reusable prompt set** for the **Release-prep agent**: it picks up exactly
where the session harness stops — features in `feature_list.json` at status `pass` — and
produces the release readiness and rollout artifacts. It is the owner of the
**"Ready for release → Released" gap** that [`../init-harness/`](../init-harness/README.md)
deliberately does not cover.

It implements the Release management workflow of
[ddd-workflow-artifacts.md §3](../README.md#upstream-only-docs) and step 8 of
[ddd-feature-delivery-workflow.md](../README.md#upstream-only-docs).

## What This Set Does

The agent **assembles release evidence from the repo** — the harness ledger
(`feature_list.json` statuses + evidence, per
[init-harness 02 §2.2](../init-harness/02-artifacts-and-templates.md)), test results, and
migration files — **runs the readiness checklist**, and **produces a release plan** with
ordered rollout steps, a compatibility matrix, and a rollback plan. The outputs land in the
repo at `docs/releases/<release-id>/`, committed with the release branch/PR.

It **NEVER deploys.** Every output is a document plus verified evidence; executing the plan —
deploys, migrations, flag flips, rollbacks — is human-owned.

## When to Use

One or more features have reached `pass` in the harness and someone wants them in production.
Not before: a feature without green gates and recorded evidence is not a release candidate —
send it back to the session loop, don't paper over it here.

## File Map

| File | What it covers | When to read |
| --- | --- | --- |
| [README.md](./README.md) | This index: purpose, scope boundary, kickoff | Start here / orientation |
| [00-system-prompt.md](./00-system-prompt.md) | Master prompt: the Release-prep agent's inputs, process, hard rules | Feed first, always |
| [01-readiness-and-rollout.md](./01-readiness-and-rollout.md) | The five templates: readiness checklist, release plan, compatibility matrix, rollback plan, release record | When filling the artifacts |

## Scope — Deliberately Excluded

**Incident management and production monitoring are OUT of scope for the prompt sets in this
repo.** They need a real production environment — live alerts, dashboards, an on-call rotation —
that no prompt set can substitute for. This set stops at **"released + observed + go/no-go
recorded"** (the Observe and Close rows of the workflow table). What comes after — alerting,
incident response, postmortems — is the Incident management workflow in
[ddd-workflow-artifacts.md §4](../README.md#upstream-only-docs).

## Usage Flow

1. Make this folder readable by the agent (copy to `docs/spec/release/` in the target repo, or
   paste files as context).
2. Kick off:

```text
Read docs/spec/release/00-system-prompt.md. Candidate features: <ids from feature_list.json>.
Produce the readiness report and release plan. STOP before any deploy action.
```

3. Review the readiness report; every unchecked item must carry an owner + accepted-risk note
   before anyone runs step 1 of the plan. Go/no-go is yours, not the agent's.

## Relationship to the Other Prompt Sets

- [`../init-harness/`](../init-harness/README.md) — supplies the evidence source
  (`feature_list.json`) and the Definition of Done this set builds on.
- [`../init-monorepo-contract/`](../init-monorepo-contract/README.md) — its drift gates are
  accepted as type-level contract evidence when contract tests don't exist (01 §1).
- The stack sets ([`../init-nestjs-hexagonal/`](../init-nestjs-hexagonal/README.md),
  [`../init-react/`](../init-react/README.md)) own how migrations, flags, and observability are
  built; this set only verifies they exist and are reversible.

# init-feature-spec — Capability Specification Before Code

This folder is a **reusable prompt set** that produces the **specification package for ONE
capability** before any stack scaffold prompt runs: a glossary slice, a use-case specification
with an explicit outcome catalog, a UI state matrix, and a contract check. It is the missing
upstream lane of the stack sets — the artifact bridge that lets an
[`init-nestjs-hexagonal`](../init-nestjs-hexagonal/README.md) backend slice and an
[`init-react`](../init-react/README.md) frontend slice be built **in parallel against the same
source of truth**, instead of against two private readings of the same ticket.

It implements phases 1 (domain discovery), 3 (feature specification), 4 (contract shape) and
5 (agent contract check) of
[ddd-feature-delivery-workflow.md](../README.md#upstream-only-docs).
In agent-taxonomy terms it covers the L1 agents **Domain analysis agent**, **Scenario agent**,
and **API contract agent**: the agent extracts, enumerates, and checks — a human approves.

## When to Use

| Situation | Verdict |
| --- | --- |
| Capability has at least one business rejection, side effect, or non-trivial UI flow | **Use this set** — spec first, scaffold second |
| Pure CRUD read (list/detail, no business rules) | Skip — the stack set's 10-scaffold INPUT CONTRACT alone is enough |
| Capability moves a bounded-context boundary or data ownership | Out of scope here — run the evolution workflow first, then this set |

## File Map

| File | What it covers | When to read |
| --- | --- | --- |
| [README.md](./README.md) | This index: purpose, composition, kickoff | Start here / orientation |
| [00-system-prompt.md](./00-system-prompt.md) | Master prompt: the Feature Spec agent's inputs, process, hard rules, approval gates | Feed first, always |
| [01-feature-spec-template.md](./01-feature-spec-template.md) | The spec template: glossary slice, use-case spec, outcome catalog, UI state matrix, FE data needs, traceability, open questions | When writing the spec |
| [02-contract-check.md](./02-contract-check.md) | The pre-implementation contract checklist and risk-list report format | After the draft spec, before any code |

## Composition with the Other Sets

- **Where outputs live:** in the **target repo** at `docs/design/<context>/<use-case>.md`
  (e.g. `docs/design/ordering/place-order.md`), status-headed `draft | approved | as-built` —
  the same intent-doc lane as [init-harness/06-design-first.md](../init-harness/06-design-first.md).
- **Feeding the stack sets:** once the spec is `approved`, its fields are pasted into the
  scaffold INPUT CONTRACTs —
  [init-nestjs-hexagonal/10-module-scaffold-prompt.md](../init-nestjs-hexagonal/10-module-scaffold-prompt.md)
  (context, use case, aggregate fields, invariants from §2) and
  [init-react/10-feature-scaffold-prompt.md](../init-react/10-feature-scaffold-prompt.md)
  (routes, operations, form rules, client state from §3–§4). The spec IS the design doc the
  React set's tier check asks for.
- **With [init-monorepo-contract](../init-monorepo-contract/README.md):** run
  [02-contract-check.md](./02-contract-check.md) against the draft contract first, and again
  against the generated `packages/contract/openapi.json` once the BE emits it.
- **Worked example:** the filled reference of exactly this template is
  [ddd-placeorder-example.md](../README.md#upstream-only-docs) (PlaceOrder).

## Kickoff Prompt

Copy this set into the target repo (e.g. `docs/spec/feature-spec/`) or paste it as context,
then kick off:

```text
Read docs/spec/feature-spec/00-system-prompt.md and adopt it.
Feature brief:
  User story: <as a ..., I want ..., so that ...>
  Acceptance criteria: <AC1 ... ACn>
Project glossary: <path/link, or "none yet">
Current API contract: <path to openapi.json / API spec, or "none yet">
Produce the spec package per 01-feature-spec-template.md into
docs/design/<context>/<use-case>.md, run 02-contract-check.md, then STOP for approval.
Do not write any application code.
```

After approval, continue with the stack scaffold prompts — the spec supplies their inputs.

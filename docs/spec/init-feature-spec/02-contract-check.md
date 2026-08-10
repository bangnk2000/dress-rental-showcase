# 02 — Contract Check (Before Implementation Starts)

This is the "agent contract check" phase of
[ddd-feature-delivery-workflow.md](../README.md#upstream-only-docs) §5,
run BEFORE any FE or BE implementation. Inputs: the glossary slice, the use-case specification,
the UI state matrix ([01-feature-spec-template.md](./01-feature-spec-template.md)), and the
contract — the draft contract shape inside the spec, or the generated
`packages/contract/openapi.json` when the repo uses
[init-monorepo-contract](../init-monorepo-contract/README.md). With a generated contract, run
the check twice: on the draft, and again on the emitted spec.

The agent answers every question below with a verdict and cited evidence.
**The agent reports; it does not approve.**

## Checklist

### 1. Naming

Is every field name and outcome code consistent with the glossary slice (Ubiquitous Language)?
Evidence: for each mismatch, the glossary term vs the contract field
(e.g. glossary says `locked price`, DTO says `finalAmount`).

### 2. Leakage

Does any DTO expose persistence or domain internals — version/lock columns, internal enums,
raw domain event objects, aggregates returned wholesale? Evidence: the offending DTO field and
where it leaks from. A command response returns the outcome plus the minimum the FE needs, not
the aggregate.

### 3. Outcome coverage

Can the FE distinguish EVERY outcome in the catalog from the wire format alone?
Convention: business outcome body `{ "status": "<code>", ...payload }`; transport/system
errors in the standard envelope
`{ "error": { "code", "message", "details"?, "correlationId" } }`.
Evidence: one example response per catalog entry; two outcomes sharing an
indistinguishable status + body shape is a finding, as is any outcome whose extra payload
(per catalog column 4) is missing from the response.

### 4. State coverage

Does the UI state matrix cover loading, duplicate submit, retry, timeout, permission, and
empty? Evidence: the matrix row per state — or the missing row, named.

### 5. Read efficiency

Does any endpoint force the FE to stitch N+1 calls or over-fetch to render a screen?
Evidence: the screen (from the state matrix / FE data needs) and the list of calls required to
render it. The read model should be shaped by UI needs (denormalized), not by table layout.

### 6. Catalog completeness

Does the error/outcome catalog cover every case in the use-case spec — every rejection step in
the business flow, every authorization denial, every transport error the FE must branch on?
Is every code stable and documented? Evidence: flow-step → code mapping; a step with no code
is a finding; an undocumented code appearing in an example is a finding.

### 7. Compatibility

Is the change additive to the existing contract (new endpoint, new optional field, new
outcome)? If breaking — field meaning changed, field removed, enum/status value changed — is a
version or deprecation/migration plan named? Evidence: diff against the current contract
(`oasdiff` output when the repo has a generated contract; manual diff otherwise).

### 8. Idempotency

Does every retryable mutation declare the `Idempotency-Key` header and its replay semantics
(same key → the first result replayed, marked as a replay)? Evidence: the header in the
endpoint spec and the matching Idempotency block in the use-case spec (01 §2). A mutation the
UI state matrix retries (network-error row) without a declared key is a blocker.

## Output Format

Emit the risk list table, then the approval line — nothing else. Empty severity levels are
stated ("no blockers"), not omitted silently.

| Severity | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- |
| blocker | {{FE cannot distinguish `rejected_out_of_stock` from `rejected_price_changed`: both return 422 with no `status` field}} | {{422 example bodies, endpoint POST /orders}} | {{add `status` code to every business-rejection body}} |
| major | {{...}} | {{...}} | {{...}} |
| minor | {{...}} | {{...}} | {{...}} |

Severity meanings: **blocker** = implementation must not start; **major** = fix before the
contract is frozen; **minor** = note it, fix opportunistically.

End the report with exactly this line:

> A responsible human confirms this risk list before FE/BE implementation starts. Blockers
> must be resolved and re-checked; the agent does not approve.

# 01 — Feature Spec Template

Copy this template to `docs/design/<context>/<use-case>.md` in the target repo and fill every
`{{...}}` slot. Delete a section only when it is genuinely N/A — and say why in one line
(e.g. "no side effects: pure state transition inside one aggregate"). The filled reference of
exactly this template is
[ddd-placeorder-example.md](../README.md#upstream-only-docs) (PlaceOrder) in this
knowledge repo.

---

# {{Capability name, e.g. Place Order}} — Feature Spec

## Header

| | |
| --- | --- |
| Bounded context | {{Ordering}} |
| Status | {{draft \| approved \| as-built}} |
| AC source | {{link to feature brief / ticket}} |
| Rules approved by | {{domain expert / product — name + date; empty while draft; `agent-default — owner said proceed <date>, defaults in §6` when the owner explicitly deferred (init-harness 07 §7.3)}} |
| Contract approved by | {{FE + BE — names + date; empty while draft}} |

## 1. Glossary slice

Only the terms this capability touches. Mark terms not yet in the project glossary as
`proposed` in Notes until the glossary owner confirms them.

| Term | Meaning | Notes |
| --- | --- | --- |
| {{Order}} | {{a purchase request the system has accepted}} | {{exists only when outcome is `accepted`}} |
| {{Quoted price}} | {{the price the customer saw when submitting}} | {{proposed — FE sends it to detect price change}} |

## 2. Use-case specification

```text
Use case: {{PlaceOrder}}
Actor: {{Customer (authenticated, account active)}}
Authorization: {{role + account-state rules, and which outcome each denial maps to —
  e.g. role customer required; locked account → forbidden}}
Trigger: {{POST /orders from the checkout page}}

Business input (fields only — no UI details):
  - {{productId}}
  - {{quantity (positive integer)}}
  - {{quotedPrice}}
  - {{idempotencyKey (client-generated, unique per submit intent)}}

Preconditions:
  - {{Product exists and is on sale.}}

Business flow (each rejection step names its outcome):
  1. {{Authorize the actor}}                             → {{forbidden}}
  2. {{Fetch available stock from Inventory}}
  3. {{If quantity > available stock}}                   → {{rejected_out_of_stock}}
  4. {{Fetch the current price from Pricing}}
  5. {{If current price ≠ quotedPrice}}                  → {{rejected_price_changed}}
  6. {{Create the Order, lock the price, reserve stock}} → {{accepted}}

Domain rules / invariants (each cites its AC):
  - R1 ({{AC1}}): {{Order.quantity ≤ available stock at acceptance time.}}
  - R2 ({{AC2}}): {{Order.lockedPrice = current price at acceptance; immutable afterwards.}}
  - R3 ({{AC3}}): {{each idempotencyKey creates at most one Order.}}

Side effects / domain events:
  - {{accepted}} → {{OrderPlaced { orderId, productId, quantity, lockedPrice }}}
    consumers: {{Inventory (reserves stock) — eventual consistency, see §4}}
  - {{rejected_* outcomes: no event, no side effect}}

Idempotency: {{required? replay semantics — e.g. required; a request with a seen key returns
  the FIRST result (even a rejection) without re-running the flow. If not required, write
  "not required because <reason>".}}
Concurrency: {{what races and who wins — e.g. two requests for the last unit: exactly one
  accepted; check-and-reserve is atomic (same transaction/lock). If none is expected, write
  "we do not expect concurrent <X> because <reason>" — a falsifiable decision, not silence.}}
```

### Outcome catalog

Codes are snake_case Ubiquitous Language terms; **stable once approved**. Every code traces to
an AC or is flagged as a new AC proposal.

| `status` code | Meaning | HTTP | Extra payload the FE needs to act |
| --- | --- | --- | --- |
| `{{accepted}}` | {{order created}} | {{201}} | {{orderId, lockedPrice}} |
| `{{rejected_out_of_stock}}` | {{not enough available stock}} | {{422}} | {{availableStock}} |
| `{{rejected_price_changed}}` | {{price changed since quote}} | {{422}} | {{currentPrice}} |
| `{{forbidden}}` | {{actor not allowed}} | {{403}} | {{reason (e.g. account_locked)}} |

## 3. UI state matrix

MUST include: idle, submitting, one row per business outcome, validation-error,
network-error/timeout, and an empty state where applicable.

| State | Condition | Display / action |
| --- | --- | --- |
| idle | {{form valid, nothing in flight}} | {{submit enabled}} |
| submitting | {{request sent, no response yet}} | {{button disabled + spinner; double submit blocked}} |
| {{accepted}} | Outcome `{{accepted}}` | {{navigate to confirmation page}} |
| {{out-of-stock}} | Outcome `{{rejected_out_of_stock}}` | {{keep form; show availableStock from payload; allow edit}} |
| {{price-changed}} | Outcome `{{rejected_price_changed}}` | {{show currentPrice; re-confirm resubmits with a NEW idempotency key}} |
| {{forbidden}} | Outcome `{{forbidden}}` | {{redirect to login / show locked-account message}} |
| validation-error | Error `validation_failed` | {{highlight fields from envelope `details`}} |
| network-error | Timeout / connection lost | {{Retry button — resend with the SAME idempotency key}} |
| empty | {{where applicable, e.g. list has no items}} | {{empty-state message + primary action}} |

Accessibility: {{outcome messages announced via aria-live; focus moves to the message region on
rejection; submit button keeps an accessible busy state while submitting}}.
Responsive: {{layout/behavior notes for small screens, e.g. sticky submit, single-column form}}.

## 4. FE data needs

What the read side must supply — shaped by the screens, not by the domain model.

- Before the command: {{available stock + current price on the product page}}.
- After the command: {{orderId + lockedPrice for the confirmation page}}.
- Denormalization: {{fields the read model pre-joins so the FE avoids N+1 —
  e.g. productName, thumbnailUrl on the order list}}.
- Projection latency: {{if the read model is a projection from events: max expected delay and
  the UX that covers it (optimistic entry, polling, "processing" notice). Otherwise write
  "read side is strongly consistent".}}

## 5. Traceability skeleton

One row per AC-scenario pair. Test levels:
`domain unit | application | provider contract | consumer contract | E2E`
(until real provider/consumer contract tests exist, the NAMED type-level drift gates — e.g.
`pnpm openapi:check`, `pnpm contract:check` — stand in as contract evidence; write which gate).

| AC | Scenario | Planned test level |
| --- | --- | --- |
| {{AC1}} | {{quantity > stock → rejected_out_of_stock}} | {{domain unit (R1); provider contract 422; consumer contract renders out-of-stock}} |
| {{AC1}} | {{two requests race for the last unit → exactly one accepted}} | {{application (concurrency)}} |
| {{AC3}} | {{resend same idempotency key → same result, no new order}} | {{application; provider contract}} |
| {{—}} | {{happy path end-to-end}} | {{E2E}} |

## 6. Open questions

Every unresolved rule or edge case lands here — never in silently invented behavior. The spec
cannot flip to `approved` while a blocker-level question is open.

| # | Question | Owner | Deadline |
| --- | --- | --- | --- |
| 1 | {{e.g. does a price DECREASE also require re-confirmation, or only an increase?}} | {{domain expert}} | {{date}} |
| 2 | {{...}} | {{...}} | {{...}} |

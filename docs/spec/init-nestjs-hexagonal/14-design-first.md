# Design-First — Tactical Design Before the First Slice

This is the NestJS-hexagonal binding of [`../init-harness/06-design-first.md`](../init-harness/06-design-first.md)
(it fills the `DESIGN_TEMPLATE` and `TRUTH_DOCS` slots). Read that file for the tiers, the
intent-vs-truth rules, and the re-sync loop; this file supplies what is stack-specific: **what a
backend design doc contains, and the three hard rules it must satisfy.**

Why it exists: aggregate boundaries and cross-context contracts are the two most expensive
things to change after code ships. A context whose boundary was decided in a design review costs
one document; one decided by accretion costs a migration, a bus refactor, and a week of
re-testing. Design-tier work (new context, new aggregate, new invariant, new cross-context
contract, anything concurrency-sensitive) gets a doc first; standard CRUD slices with a single
happy path use the filled input contract of `10-module-scaffold-prompt.md` as their mini design
doc — but any use case with business outcomes beyond the happy path also carries a use-case spec
(§2, "The use-case specification"), standard tier included.

## 1. The Artifacts

| Artifact | Location | Scope |
| --- | --- | --- |
| SRS / requirements brief | `docs/SRS-<product>.md` | Product or phase; the FR-ids that design docs and `feature_list.json` trace back to |
| Context design doc | `docs/design/<context>-aggregate.md` | ONE bounded context — written before the context's first design-tier slice |
| Use-case specification | `docs/design/<context>/<use-case>.md` | ONE capability — Required when it has business rejections, side effects, or a retry story (template: [`../init-feature-spec/`](../init-feature-spec/README.md)) |
| ADR | `docs/design/adr/NNNN-<slug>.md` | One cross-cutting decision (incl. deliberate deviations from this spec) |
| Truth docs (generated) | `docs/architecture-map.md` (slice/event/contract inventory via a `gen-map` script) + `docs/openapi.json` | Whole repo; each wired to a `*:check` CI gate (regenerate + `git diff --exit-code`) |

A design doc index (`docs/design/README.md`) lists every context with its role
(core/supporting/generic), aggregates, and the cross-context contract matrix — the one table
that shows how contexts touch without importing each other.

## 2. The Context Design Doc Template

```markdown
# <Context> — Tactical Design
> Status: draft | approved | as-built <date>   ·   SRS: FR-XXX..

## Role & boundary
Core/supporting/generic; one paragraph on what is INSIDE and what is deliberately outside.

## Aggregates
| Aggregate root | Internal entities | Value objects | Enums/types |
One row per aggregate. An aggregate = one consistency boundary = one transaction.

## State machine (per aggregate with lifecycle)
| From | Action (entity method) | To | Guard |
The TRANSITIONS table the entity implements verbatim.

## Invariant enforcement (the load-bearing section — see §3.1)
| Invariant | Application check | DB mechanism | On violation | Proof test |

## Persistence sketch
Tables; aggregate↔row strategy (row-per-entity vs single-row JSONB) and WHY;
concurrency strategy for concurrent writes (version column / SELECT FOR UPDATE / constraint).

## Cross-context contracts (see §3.2)
| Contract query/event | Owner | Consumers | Returns |

## Domain events
| Event | Raised by | Consumer | — an event with NO consumer is listed as "none yet"
and gets NO outbox/relay/subscriber infrastructure until one exists (01 §8 YAGNI).

## Open questions / ADR links
```

Keep it under ~2 pages per context. The doc records decisions and their why; the generated
architecture map records what currently exists — never duplicate the second into the first.

### The use-case specification (per capability)

The context doc designs the AGGREGATE; it does not specify a capability's behavior at the
boundary. Every use case with at least one business rejection, side effect/event, or retry story
gets a **use-case spec** at `docs/design/<context>/<use-case>.md` — standard tier included. Only
pure CRUD with a single happy path may rely on the filled scaffold INPUT CONTRACT alone.

Minimum fields (full template + authoring workflow:
[`../init-feature-spec/01-feature-spec-template.md`](../init-feature-spec/01-feature-spec-template.md)):

- Actor + authorization (which denial maps to which outcome).
- Business input, preconditions, numbered business flow — each rejection step names its outcome.
- Domain rules/invariants with AC references; rows feed the invariant-enforcement table above.
- **Outcome catalog** — `status` code | meaning | HTTP | payload the FE needs. This table is the
  single source for the controller's outcome map (`06-interface-layer.md` §5) and for the FE
  slice's `outcomes` input; codes are snake_case Ubiquitous Language, stable once approved.
- Side effects/domain events, idempotency (required? replay semantics), concurrency behavior.

Same status header as the context doc (`draft | approved | as-built`); a scaffold prompt may not
run against a `draft` spec.

## 3. The Three Hard Rules (MUST — same weight as the Dependency Rule)

### 3.1 Critical invariants are enforced by the database, not only by application code

An invariant is *critical* when violating it corrupts business state: uniqueness ("one active
registration per user per event"), non-overlap ("one resource cannot be double-booked"),
capacity, balance ≥ 0. For every critical invariant:

- **The database refuses it**: `UNIQUE`, `CHECK`, foreign keys, or `EXCLUDE USING gist` for
  range overlaps (with `btree_gist`). A read-then-write check in a handler has a race window
  between the read and the write; the constraint has none.
- **The application pre-checks** the same rule before writing — but only to produce a precise
  domain error message. The pre-check is a courtesy; the constraint is the enforcement.
- **The repository maps the constraint violation** to the same domain error the pre-check
  produces — so both paths surface as the same outcome body (`06-interface-layer.md` §5) and
  the race-condition path and the friendly path are indistinguishable to clients.

```sql
-- migration: the invariant "a dress cannot be double-booked" lives HERE, not in a handler
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE rental_items ADD CONSTRAINT rental_items_no_overlap
  EXCLUDE USING gist (dress_id WITH =, blocked_period WITH &&) WHERE (blocking);
```

```ts
// repository: the race path converges on the same outcome as the pre-check path
try { await this.writeInTransaction(entity, insert); }
catch (e) {
  if (isExclusionViolation(e, 'rental_items_no_overlap'))
    throw new DressUnavailableError(); // handler → Err → same outcome body as the pre-check
  throw e;
}
```

For lost-update protection on aggregates stored as single-row JSONB (or any aggregate two
requests may save concurrently), the design doc must name the mechanism — optimistic version
column checked on `UPDATE ... WHERE version = $expected`, or `SELECT ... FOR UPDATE`. "We don't
expect concurrency" is a decision; write it in the doc so it is falsifiable.

### 3.2 Cross-context communication is contract-only — never another context's tables

Modules already cannot import each other (01 §4, CI-enforced). This rule closes the loophole
dependency-cruiser cannot see: **an adapter in context A that queries context B's TABLES is
forbidden.** Schema-level coupling is invisible to every guardrail — renaming a column in B
silently breaks A. The two sanctioned channels:

1. **Contract query on the QueryBus.** The query class lives in `libs/contracts/<owner-context>/`;
   owner implements the handler, consumers dispatch it. Both sides import `libs/`, neither
   imports the other — the coupling is a named, typed, greppable contract, and the generated
   architecture map lists it.
2. **Domain events** (via bus/outbox once a consumer exists), matched by event name.

An ACL adapter (01 §4.3) wraps an *external* system, or translates at a *sanctioned* boundary —
it never becomes a tunnel into a sibling context's schema.

### 3.3 Every DB-enforced invariant has a test that provokes the constraint

For each row of the invariant-enforcement table: an integration/e2e test that attempts the
violation — the duplicate insert, the overlapping range, the double registration (two concurrent
requests, not two sequential ones, when the invariant is race-sensitive) — and asserts the
mapped domain error / HTTP status. Against real Postgres (testcontainers locally, a service
container in CI — `09-testing-strategy.md`). A migration that adds a constraint no test
provokes is an unproven promise; the design doc's Proof-test column stays empty until CI runs it.

## 4. Truth Docs — the generated half

Wire these at bootstrap (Phase 4 of `12-implementation-checklist.md`):

- **`docs/architecture-map.md`** — a zero-dependency script (`scripts/gen-map.mjs`) that parses
  the naming conventions on disk (this set's file map makes the repo machine-parseable) and
  emits the inventory: slices → endpoints, events → raisers → consumers, contracts → owners →
  callers, per-slice test presence. `pnpm map` regenerates; `pnpm map:check` diffs in CI.
- **`docs/openapi.json`** — emitted deterministically without booting infra
  (see `../init-monorepo-contract/02-contract-pipeline.md` §2 for the offline-emit pattern);
  `pnpm openapi:emit` regenerates; `pnpm openapi:check` diffs in CI.

These two make the design docs safe to keep small: intent in `docs/design/`, current state
generated, drift structurally impossible.

## 5. Re-Sync

After a design-tier feature merges: stamp the context doc's status line (`as-built <date>`,
noting deviations and why), promote any new cross-cutting decision to an ADR, and let the
`*:check` gates handle the generated half. The audit checklist
([`../init-harness/04-audit-checklist.md`](../init-harness/04-audit-checklist.md)) treats an
unreconciled design doc older than one merged feature as a critical finding.

## 6. Smells

- A new aggregate or contract query appearing in a PR with no design-doc diff in the same PR —
  design happened in the code review comments, i.e. too late.
- An invariant-enforcement row whose DB-mechanism cell says "application check" — that is the
  courtesy column duplicated, not enforcement.
- A `SELECT` in one module naming another module's table (grep for cross-context table names in
  `modules/*/database/` — cheap to wire into `scripts/check-architecture.sh`).
- Outbox/relay/subscriber machinery shipped alongside events that have no consumer.
- A concurrency-sensitive invariant whose proof test only exercises the sequential path.

# Design-First — UX & Structure Before the First Component

This is the React-SPA binding of [`../init-harness/06-design-first.md`](../init-harness/06-design-first.md)
(it fills the `DESIGN_TEMPLATE` slot). Read that file for the tiers, intent-vs-truth rules, and
the re-sync loop; this file supplies what is frontend-specific: **the two planning levels, the
slice design template (UX included), the UI Foundation, and where visual work fits.**

The frontend split of expensive-vs-cheap is different from the backend's, and getting it wrong
wastes the design effort: **structure and behaviour are expensive to change after code**
(routes, URL state, navigation model, the invalidation map, interaction flows); **visual surface
is cheap** (spacing, colors within tokens, copy). Design docs cover the first kind; the second
kind is iterated on the running app and never written down outside the tokens.

## 1. Two Planning Levels

**Level 1 — the bootstrap brief** (`docs/BOOTSTRAP.md`, one per product, before Phase 0 of
`12-implementation-checklist.md`): product idea paragraph; the feature-slice table mapping SRS
requirements ↔ API tags ↔ release phases (this table seeds `feature_list.json`); the Phase-0
decisions (auth model, languages, PWA, routing); and **contract gaps** — endpoints the FE needs
that `openapi.json` doesn't have yet. Finding a missing auth endpoint at brief time costs a
paragraph; finding it mid-slice costs a stubbed flow and a rework. Every gap gets a decision:
block, stub behind the generated hook, or send the BE a change request.

**Level 2 — the per-slice design doc** (`docs/design/<slice>.md`), tiered per
[`../init-harness/06-design-first.md`](../init-harness/06-design-first.md) §6.3:

| Tier | FE criteria | Artifact |
| --- | --- | --- |
| Standard | List + form on existing patterns, no new interaction model | The filled INPUT CONTRACT of `10-feature-scaffold-prompt.md` — that block IS the design doc |
| Design-tier | New interaction pattern (calendar, builder, board, bracket, multi-step flow), lifecycle-driven UI mirroring a backend state machine, new navigation area, role-dependent surfaces | Full template below, reviewed before code |

## 2. The Slice Design Doc Template

```markdown
# <slice> — Design
> Status: draft | approved | as-built <date>   ·   SRS: FR-XXX   ·   API tags: <tags>

## 0. UX flow  (FIRST — it drives every section below)
Per role: the happy path and each error/edge path, as a short numbered flow.
Layout intent as a low-fi wireframe (ASCII) or a throwaway HTML prototype — cheap with an
agent: generate a static clickable page, approve the structure, THEN build. Never pixels.

## 1. Routes & URL state
Routes owned; guard; what lives in the URL (filters/tabs/page — shareable, testable) vs
component state. Deep links after the fact are a refactor; decide now.

## 2. Data map  (the FE "aggregate design")
Generated hooks consumed; for EVERY mutation: which query keys it invalidates;
server state (query cache only) vs client state (URL/store) vs derived.

## 3. Interaction state machine
For status-driven UI: which actions are VISIBLE/enabled per status — driven by the status
values and transitions the API CONTRACT exposes (use-case spec / outcome catalog), so an
impossible action is unreachable, not error-handled. Never mirror the backend entity's
internal transitions table: if the contract doesn't expose a status, the UI doesn't know it.

## 4. Screen states & error policy
Per screen: loading / empty / error — with actual copy (i18n keys), not "has empty state".
Per mutation: submitting (double-submit blocked), success (navigate/toast/reset?), retry
(same Idempotency-Key on timeout/network — 04 §3).
Business outcomes: ONE ROW PER outcome code from the use-case spec catalog
(`rejected_out_of_stock` → which message, which action, keep the form?). Faults:
which are local (validation `details[]` → field errors) vs global (401 refresh, 5xx
boundary). Branch on `mapApiError` output, never on raw HTTP status.
A11y: `aria-live` on the outcome/notice region; focus moves to it on rejection.
Responsive: name the slice's mobile behavior here, not in the polish pass.
Role gating: what organizer sees vs participant.

## 5. Form ↔ DTO mapping
Zod form schema fields ↔ request DTO fields; divergences (client-only fields, coercions).

## 6. Test plan
MSW handlers + state seeds needed; the flows worth an RTL test; e2e if it's a core flow.
```

Sections 0–1 are UX; 2–3 are the data/behaviour skeleton; UX comes first because the flow
decides which hooks, keys, and states exist — writing §2 before §0 is designing the plumbing of
a house with no floor plan.

## 3. UI Foundation — once, before the first slice

One document (`docs/design/ui-foundation.md`) + the `@theme` tokens, produced in Phase 2 of
`12-implementation-checklist.md`. This is the UI's shared kernel — slices ASSEMBLE patterns from
it; they never invent their own:

- **Tokens**: brand + semantic colors (oklch, in `@theme`), typography scale, spacing, radius;
  light/dark decided day one (retrofitting dark mode is a full sweep).
- **Density & device context**: which screens are mobile-first vs desktop-first — an internal
  tool's admin tables and its on-site phone flows have different defaults; name them.
- **Layout shell & navigation model**: sidebar vs top-nav, header composition, where the
  language switcher and notifications live. Changing the navigation model after five slices is a
  real refactor — this decision is ADR-worthy.
- **Shared patterns**: data table (sort/filter/empty), form layout, confirm-dialog policy for
  destructive actions, toast vs inline-error policy, skeleton/loading conventions.
- **i18n layout constraints**: rules for string length variance between languages (truncation,
  wrapping, min-widths) — decided once here, not ad-hoc per screen.

When a slice needs a pattern the foundation lacks (a bracket view, a kanban column), the pattern
is designed **at foundation level** and the slice consumes it — that keeps slice #7 looking like
slice #1.

## 4. Where Visual Work Fits — the three insertion points

```
(1) UI Foundation        once, Phase 2            structure of the visual system
(2) UX flow + wireframe  per slice, in the doc    structure of the screen (§2 template, section 0)
    …implement: scaffold → build to WORKING, plain-looking, correct states…
(3) Visual polish pass   per slice, after green   spacing/alignment/responsive/dark/hover-focus,
                                                  on the REAL app with real or MSW data
```

The polish pass (3) ends with the **UX checklist** — append these to
`clean-state-checklist.md` for UI-touching features:

- [ ] Every configured language renders without breaking layout (length variance checked).
- [ ] Keyboard walks the primary flow; focus lands sensibly after submit/dialog close.
- [ ] Mobile breakpoint: no horizontal overflow on the slice's screens.
- [ ] Empty and error states seen with eyes (MSW-forced), not just asserted in tests.
- [ ] Playwright screenshot(s) of the finished screens attached as `feature_list.json`
      evidence — proof now, visual baseline later.

## 5. Truth Docs — the generated half

The FE's intent docs stay honest the same way the BE's do (
[`../init-harness/06-design-first.md`](../init-harness/06-design-first.md) §6.1): what a script
can derive is generated, gated, and never hand-maintained.

- `src/api/generated/` + `openapi.json` are already truth docs with a freshness gate (04 §7).
- Recommended once the app passes ~5 slices: a `scripts/gen-map.mjs` inventory — route →
  feature → generated hooks imported → i18n namespace → has tests — emitted to
  `docs/architecture-map.md` with a `map:check` diff gate in CI. The conventions in
  `02-folder-structure.md` make the repo machine-parseable; use that.

## 6. Smells

- A design-tier slice (new interaction pattern) built straight from the scaffold prompt — the
  tier gate was skipped; the review happens in rework instead.
- Pixel values, margins, or color hexes inside a design doc — surface detail fossilizing in an
  intent doc; it belongs in tokens and the polish pass.
- A mutation merged with no invalidation entry in the doc's data map (and no commented reason) —
  the stale-UI bug is designed in.
- Two slices with visibly different table/form/empty-state conventions — foundation patterns
  being reinvented per slice.
- An interaction that mirrors a backend state machine, hand-rolled as scattered `if`s with error
  toasts for impossible actions — section 3 of the template existed to make those unreachable.
- Polish-pass work (alignment, spacing) blocking the functional review — the phases exist so
  correctness and cosmetics don't hold each other hostage.

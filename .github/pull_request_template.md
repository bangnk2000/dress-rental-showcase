## What / why
<!-- one paragraph; the FR/BR id(s) this serves (docs/SRS-*.md) -->

## Control facts (reviewer reads these first)
- Ledger entry: `<id>` → status `<status>`, tier `<mechanical|standard|design>`
- Requirement: <FR-…> · Design doc: <path> — state `<draft|agent-default|approved|as-built>`
- Owner decisions still open (`node scripts/ledger.mjs pending`): <none | list>
- Contract / generated clients changed: <no | yes — `pnpm contract`, committed with the BE source>
- Migration: <no | yes — apps/be/migrations/<file>, down tested on <env>>
- Deploy order: <n/a | e.g. migrate → be → web>; safe against the currently deployed peer? <yes/no + why>

## Evidence
<!-- commands run + what was observed; which AC each proved. CI link once green. -->

## Agent attribution
- [ ] Agent-authored commits carry a `Co-Authored-By:` trailer

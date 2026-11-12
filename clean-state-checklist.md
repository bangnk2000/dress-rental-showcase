# Clean-State Checklist (end of every session)

The one close procedure: root `AGENTS.md` §Session rules says *when*, this file says *what*.

## Verification

- [ ] `bash init.sh` passes — it starts with `node scripts/ledger.mjs check` and includes the real
      invariant-proof gate, so start Postgres (`docker compose up -d`) or accept its explicit skip
      WARN. Playwright stays outside it.
- [ ] Design-tier work: its design doc under `docs/design/` was approved BEFORE the code, and now
      carries the dated as-built note (`docs/spec/init-harness/06-design-first.md` §6.4)

## State

- [ ] `feature_list.json`: edit only the touched entry (never read or rewrite the whole file);
      `node scripts/ledger.mjs check` green; every "pass" has evidence naming commands AND
      observations; when the entry has `acceptance`, the evidence says which AC each command proved.
      Quotes inside evidence strings are escaped (`\"`) — prefer single quotes
- [ ] `session-handoff.md`: prepend ONE entry `## YYYY-MM-DD (N) — <title>` with Done / Proof / Next /
      Watch out, ≤ ~8 lines (detail belongs in the ledger evidence or the design doc;
      `ledger.mjs brief` prints the block up to the next `## `). Keep at most 5 entries: move the
      oldest, verbatim, to the top of `docs/harness/session-handoff-archive.md` (history only),
      prefixing its relative link targets with `../../`. Never reword an existing entry
- [ ] `claude-progress.md`: one line inserted directly under its header (newest first); never
      rewrite old lines
- [ ] Root `AGENTS.md` Current state re-checked against the repo as-committed (usually only the
      Production bullet; a row only if an area changed shape)

## Which doc to update (keep each fact in ONE place)

| When this changes … | Update | Never |
| --- | --- | --- |
| A ledger entry's status/evidence | `feature_list.json` (edit only that entry; then `node scripts/ledger.mjs check`) | read the whole file |
| Session ends | prepend one `session-handoff.md` entry (rotate as above) + one `claude-progress.md` line | rewrite old entries |
| A behaviour/rule inside one app | that app's `AGENTS.md` or the feature's `docs/design/` doc (dated as-built note) | copy it into the root `AGENTS.md` |
| Something gets deployed | the **Production** bullet in root `AGENTS.md` + `deploy.deployed` on the entry + the release/runbook record | — |
| An app/context is added or changes shape | its row in the root `AGENTS.md` Current state table | per-feature detail in the row |
| A requirement (FR/BR/NFR) | `docs/SRS-*.md` in the same PR | — |

## Repository

- [ ] No unintended diff under `packages/contract/` or `apps/{fe,qr-admin,web}/src/api/generated/`
- [ ] If BE DTOs changed this session: contract + ALL THREE generated clients are in the SAME commit
- [ ] `docs/spec/` untouched unless this session was a deliberate upstream re-sync — it is vendored
      spec (`docs/spec/README.md`); a local "improvement" there is lost at the next sync
- [ ] No stray files at repo root; scratch work deleted

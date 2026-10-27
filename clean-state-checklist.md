# Clean-State Checklist (end of every session)

## Verification

- [ ] `bash init.sh` passes — it starts with `node scripts/ledger.mjs check` and includes the real
      invariant-proof gate, so start Postgres (`docker compose up -d`) or accept its explicit skip
      WARN. Playwright stays outside it.
- [ ] Design-tier work: its design doc under `docs/design/` was approved BEFORE the code, and now
      carries the dated as-built note (`docs/spec/init-harness/06-design-first.md` §6.4)

## State

- [ ] `feature_list.json`: `node scripts/ledger.mjs check` green; every "pass" has evidence naming
      commands AND observations; when the entry has `acceptance`, the evidence says which AC each
      command proved. Quotes inside evidence strings are escaped (`\"`) — prefer single quotes
- [ ] `session-handoff.md`: one new entry on top (done / proof / next / watch out); at most 5
      entries kept, the oldest moved verbatim to `docs/harness/session-handoff-archive.md`
- [ ] `claude-progress.md`: one appended line for this session
- [ ] Root `AGENTS.md` Current state re-checked (Production bullet; a row only if an area changed shape)

## Repository

- [ ] No unintended diff under `packages/contract/` or `apps/{fe,qr-admin,web}/src/api/generated/`
- [ ] If BE DTOs changed this session: contract + ALL THREE generated clients are in the SAME commit
- [ ] `docs/spec/` untouched unless this session was a deliberate upstream re-sync — it is vendored
      spec (`docs/spec/README.md`); a local "improvement" there is lost at the next sync
- [ ] No stray files at repo root; scratch work deleted

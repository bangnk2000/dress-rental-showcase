# Clean-State Checklist (end of every session)

## Verification

- [ ] `bash init.sh` passes — it now includes the real invariant-proof gate, so start Postgres
      (`docker compose up -d`) or accept its explicit skip WARN. Playwright stays outside it.
- [ ] Design-tier work: its design doc under `docs/design/` was approved BEFORE the code, and now
      carries the dated as-built note (`docs/spec/init-harness/06-design-first.md` §6.4)

## State

- [ ] `feature_list.json`: at most ONE in-progress; every "pass" has evidence naming commands AND
      observations; when the entry has `acceptance`, the evidence says which AC each command proved
- [ ] `session-handoff.md` updated: done / next / watch-outs
- [ ] `claude-progress.md`: one appended entry for this session
- [ ] Root `AGENTS.md` Current state re-synced to the repo as-committed

## Repository

- [ ] No unintended diff under `packages/contract/`, `apps/fe/src/api/generated/` or
      `apps/qr-admin/src/api/generated/`
- [ ] If BE DTOs changed this session: contract + BOTH generated clients are in the SAME commit
- [ ] `docs/spec/` untouched unless this session was a deliberate upstream re-sync — it is vendored
      spec (`docs/spec/README.md`); a local "improvement" there is lost at the next sync
- [ ] No stray files at repo root; scratch work deleted

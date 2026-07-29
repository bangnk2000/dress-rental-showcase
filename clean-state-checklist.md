# Clean-State Checklist (end of every session)

- [ ] `bash init.sh` passes (or degrades with only the expected bootstrap WARNs)
- [ ] `feature_list.json`: at most ONE in-progress; every "pass" has evidence
- [ ] `session-handoff.md` updated: done / next / watch-outs
- [ ] No unintended diff under `packages/contract/` or `apps/fe/src/api/generated/`
- [ ] If BE DTOs changed this session: contract + generated client diffs are in the SAME commit
- [ ] No stray files at repo root; scratch work deleted

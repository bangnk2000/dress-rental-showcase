# Readiness and Rollout — the Five Templates

Templates with `{{slots}}`. §1 is filled once **per candidate feature**; §2–§5 once **per
release** (one release may carry several features). Fill only from evidence found in the repo
or CI; anything unprovable stays `missing` per the hard rules in
[00-system-prompt.md](./00-system-prompt.md). Filled artifacts are written into the repo at
`docs/releases/<release-id>/` (`readiness-<feature-id>.md`, `release-plan.md`, `rollback.md`,
`record.md`), committed with the release branch/PR.

## 1. Feature Readiness Checklist (one per feature)

```markdown
# Readiness — {{FEATURE_ID}}: {{FEATURE_NAME}}

| Check | Status | Evidence |
| --- | --- | --- |
| Spec approved; names still consistent with glossary | {{ok/missing}} | {{spec path + approval ref; drift found, if any}} |
| All harness gates green | {{ok/missing}} | {{exact commands + testedAt dates from feature_list.json}} |
| Contract evidence: provider + consumer tests | {{ok/missing/n-a}} | {{test run links; OR "type-level drift gates green: {{GATE_NAMES}}" when contract tests don't exist — name which}} |
| Acceptance criteria coverage | {{ok/partial/missing}} | See AC table below |
| Migration has a rollback plan | {{ok/missing/no-migration}} | {{migration file + down/reversal path, or "no migration"}} |
| Observability for new behavior | {{ok/missing}} | {{dashboard/alert links covering the new outcome codes + error rates}} |
| Feature flag | {{ok/missing}} | {{FLAG_NAME}}, default: {{off/on}}; "none — full-on release" is a recorded risk |
| Owner + on-call | {{ok/missing}} | {{OWNER}}, on-call: {{ON_CALL}} |

### Acceptance criteria → test evidence

| # | Acceptance criterion | Test evidence |
| --- | --- | --- |
| 1 | {{AC_TEXT}} | {{test file / CI run link}} |
| 2 | {{AC_TEXT}} | {{...}} |

### Unchecked items (each one blocks until owned)

| Item | Owner | Accepted-risk note (explicit, or the release does not proceed) |
| --- | --- | --- |
| {{ITEM}} | {{NAME}} | {{WHY_ACCEPTABLE + until-when}} |
```

## 2. Release Plan

The step order is fixed — it is what makes the compatibility matrix (§3) survivable: each
combination that exists mid-rollout must already be proven safe. Every step names a command,
an owner, and a verification; a step nobody can verify is not a step.

```markdown
# Release Plan — {{RELEASE_ID}} ({{DATE}})
Features: {{FEATURE_IDS from feature_list.json}}

| # | Step | Command / action | Owner | Verification |
| --- | --- | --- | --- | --- |
| 1 | Deploy backward-compatible BE {{BE_SHA}} | {{DEPLOY_CMD}} | {{OWNER}} | {{health check + old FE still functions against new BE}} |
| 2 | Run safe migration {{MIGRATION_ID}} | {{MIGRATION_CMD}} | {{OWNER}} | {{schema/row-count check; reversal path confirmed present}} |
| 3 | Deploy FE {{FE_SHA}} | {{DEPLOY_CMD}} | {{OWNER}} | {{smoke: key pages load, contract calls succeed}} |
| 4 | Enable {{FLAG_NAME}} for {{COHORT}} (small) | {{FLAG_ACTION}} | {{OWNER}} | {{flag state readable; cohort sees new behavior, others don't}} |
| 5 | Observe for {{WINDOW}} | Watch list below | {{OWNER}} | All watched signals within thresholds (§4 triggers not hit) |
| 6 | Expand rollout — or rollback per §4 | {{EXPAND_STEPS}} | {{DECIDER}} | Go/no-go recorded in §5 |

Watch list for step 5 — metrics AND business outcomes:
- Outcome-rate shifts: {{OUTCOME_CODES}} rates vs pre-release baseline
- Contract-validation failures (schema/4xx spikes on {{ENDPOINTS}})
- Latency / timeout / retry rates on {{ENDPOINTS}}
- Duplicate requests (idempotency-key collisions, double submits)
- {{FEATURE_KPI — the business number this feature was built to move}}
```

## 3. Compatibility Matrix

Both mixed combinations exist during rollout (and again during rollback). Each cell needs
evidence — a test run or a written analysis with a path — not an opinion.

```markdown
| Combination | What breaks | What degrades | Evidence |
| --- | --- | --- | --- |
| New FE + old BE | {{hard failures, or "nothing"}} | {{fallbacks/hidden features}} | {{test run / analysis link}} |
| New BE + old FE | {{hard failures, or "nothing"}} | {{ignored fields/defaults}} | {{test run / analysis link}} |
```

"New BE + old FE" must be clean — step 1 of the plan depends on it. If it is not, the release
plan is invalid as ordered: stop and report.

## 4. Rollback Plan

```markdown
# Rollback — {{RELEASE_ID}}

## Trigger conditions (thresholds, not vibes)
| Condition | Threshold | Source |
| --- | --- | --- |
| Error rate on {{ENDPOINT}} | > {{N}}% over {{M}} min | {{dashboard/alert link}} |
| {{OUTCOME_CODE}} rate shift vs baseline | > {{N}}% | {{dashboard link}} |
| {{FEATURE_KPI}} regression | {{THRESHOLD}} | {{source}} |

## Steps (cheapest reversal first)
1. Disable {{FLAG_NAME}} → verify cohort reverts to old behavior: {{CHECK}}
2. If insufficient: redeploy FE {{PREV_FE_SHA}} → verify: {{CHECK}}
3. If insufficient: redeploy BE {{PREV_BE_SHA}} → verify: {{CHECK}}
4. Migration reversal: {{DOWN_MIGRATION_CMD, or "roll-forward only — state why and what that implies"}}

## Data implications
{{What data written by the new version survives a rollback; what must be repaired or is lost;
"none" only with reasoning}}

## Who decides
{{NAME/ROLE}} triggers a rollback — nobody else, including any agent.
```

## 5. Release Record + Close

Filled during and after execution — by the humans running the plan; the agent only seeds it.

```markdown
# Release Record — {{RELEASE_ID}}

| Field | Value |
| --- | --- |
| BE deployed | {{BE_SHA/tag}} at {{TIMESTAMP}} |
| FE deployed | {{FE_SHA/tag}} at {{TIMESTAMP}} |
| Migrations applied | {{IDS, or "none"}} |
| Flag states | {{FLAG_NAME}}: {{state per environment/cohort}} |
| Go/no-go | {{GO / NO-GO}} — decided by {{NAME}} on {{DATE}} |
| Known issues | {{list, or "none"}} |
| Features released | {{FEATURE_IDS}} — links back to `feature_list.json` entries |
```

Close-out: append the release id and record link to each released feature's `evidence` field in
`feature_list.json` (the harness has no `released` status — the record IS the proof), and file
known issues into the backlog. Anything discovered in production after this point belongs to
the incident or evolution workflows, not to this set.

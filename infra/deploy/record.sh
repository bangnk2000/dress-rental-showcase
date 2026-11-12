#!/usr/bin/env bash
# Records the SHA as deployed — last step, only after every step and verify.sh passed, and only when
# plan.sh said this run covered everything the diff needed (or after a rollback.sh swap).
#  - .deployed: same line format as WSL sync.sh (the fallback scripts and status.sh keep reading it),
#    with `version=` appended at the END so `^sha=` parsing is unchanged;
#  - .deploy-history: one appended line per deploy/rollback, never rewritten
#    (docs/design/deploy-versioning.md §3.2). rollback.sh picks its target from it.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${TARGET_SHA:?}" "${RUN_URL:=}" "${VERSION:=unversioned}" "${KIND:=deploy}" "${PARTS:=}" "${OPS_SHA:=unknown}"
rssh "set -e; cd $REMOTE_DIR; now=\$(date -Is)
printf 'sha=%s branch=master date=%s target=tencent by=github-actions run=%s version=%s\n' '$TARGET_SHA' \"\$now\" '$RUN_URL' '$VERSION' >.deployed
printf 'version=%s sha=%s kind=%s parts=%s ops=%s date=%s by=github-actions run=%s\n' '$VERSION' '$TARGET_SHA' '$KIND' '${PARTS:-none}' '$OPS_SHA' \"\$now\" '$RUN_URL' >>.deploy-history
cat .deployed; tail -1 .deploy-history"

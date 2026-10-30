#!/usr/bin/env bash
# Decides what this deploy does, from the diff between the SHA the VPS last recorded and the target.
#   in : TARGET_SHA, ONLY (auto|all|be|fe|web), BACKUP (auto|always)
#   out: be fe web backup record  (true/false each) → $GITHUB_OUTPUT
# Rules (RUNBOOK §7 as code):
#  - a new migration forces a proven backup BEFORE the BE build migrates;
#  - going BACK across a migration is refused: build-be only migrates up, so that rollback is manual;
#  - unknown deployed SHA, or one that is not an ancestor of the target → deploy everything;
#  - `record` (write .deployed at the end) only when this run covers everything the diff needs,
#    so the next `auto` run never mistakes a partial deploy for a complete one.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${TARGET_SHA:?}" "${ONLY:=auto}" "${BACKUP:=auto}"
cd "$REPO_ROOT"

DEPLOYED=$(deployed_sha)
echo "deployed: ${DEPLOYED:-unknown} | target: $TARGET_SHA | only=$ONLY backup=$BACKUP"

need_be=true need_fe=true need_web=true migration=false
if [ -z "$DEPLOYED" ] || ! git cat-file -e "$DEPLOYED^{commit}" 2>/dev/null; then
  echo "deployed SHA unknown to this checkout → everything is needed"
elif [ "$DEPLOYED" = "$TARGET_SHA" ]; then
  echo "target is already the recorded deploy → nothing is needed"
  need_be=false need_fe=false need_web=false
else
  CHANGED=$(git diff --name-only "$DEPLOYED" "$TARGET_SHA")
  echo "changed files: $(printf '%s\n' "$CHANGED" | grep -c .)"
  shared='^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|packages/)'
  grep -qE "^apps/be/|$shared" <<<"$CHANGED" || need_be=false
  grep -qE "^apps/fe/|$shared" <<<"$CHANGED" || need_fe=false
  grep -qE "^apps/web/|$shared" <<<"$CHANGED" || need_web=false
  grep -q '^apps/be/migrations/' <<<"$CHANGED" && migration=true
  if $migration && git merge-base --is-ancestor "$TARGET_SHA" "$DEPLOYED"; then
    echo "::error::target ${TARGET_SHA:0:7} is OLDER than the deployed ${DEPLOYED:0:7} and the range touches apps/be/migrations — a rollback across a migration is manual (RUNBOOK), refusing"
    exit 1
  fi
fi

case "$ONLY" in
  auto) be=$need_be fe=$need_fe web=$need_web ;;
  all)  be=true fe=true web=true ;;
  be|fe|web) be=false fe=false web=false; printf -v "$ONLY" true ;;
  *) echo "::error::ONLY must be auto|all|be|fe|web, got '$ONLY'"; exit 1 ;;
esac

record=true
for c in be fe web; do
  n="need_$c"
  if [ "${!n}" = true ] && [ "${!c}" = false ]; then
    record=false
    echo "::warning::$c changed since the recorded deploy but is not part of this run — .deployed stays at ${DEPLOYED:-unknown}"
  fi
done

backup=false
if [ "$BACKUP" = always ]; then backup=true
elif $migration && [ "$be" = true ]; then backup=true
fi
if $migration && [ "$be" = false ]; then
  echo "::warning::the range carries a migration but the BE is not deployed in this run — the migration waits for the next BE deploy"
fi

echo "plan: be=$be fe=$fe web=$web backup=$backup record=$record (migration in range: $migration)"
{
  echo "be=$be"; echo "fe=$fe"; echo "web=$web"; echo "backup=$backup"; echo "record=$record"
} >>"${GITHUB_OUTPUT:-/dev/stdout}"

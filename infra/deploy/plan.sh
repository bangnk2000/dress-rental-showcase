#!/usr/bin/env bash
# Decides what this deploy does, from the diff between the SHA the VPS last recorded and the target.
#   in : TARGET_SHA, ONLY (auto|all|be|fe|web), BACKUP (auto|always), BUMP (patch|minor|major)
#   out: be fe web backup record mint (true/false each), version, previous → $GITHUB_OUTPUT
# Rules (RUNBOOK §7 as code):
#  - a new migration forces a proven backup BEFORE the BE build migrates;
#  - going BACK across a migration is refused: build-be only migrates up, so that rollback is manual;
#  - unknown deployed SHA → deploy everything AND treat it as carrying a migration (backup first);
#  - an ssh failure while reading .deployed aborts (lib.sh deployed_sha), it is not "unknown";
#  - `record` (write .deployed at the end) only when this run covers everything the diff needs,
#    so the next `auto` run never mistakes a partial deploy for a complete one;
#  - version (docs/design/deploy-versioning.md §3.1): the tag already on the target, else — for a
#    complete run — the highest vX.Y.Z bumped by BUMP (`mint`: the tag job creates it after verify),
#    else (partial run) `<highest>+<sha7>`, which never becomes a tag. No vX.Y.Z tag at all → refuse.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${TARGET_SHA:?}" "${ONLY:=auto}" "${BACKUP:=auto}" "${BUMP:=patch}"
cd "$REPO_ROOT"

# PLAN_DEPLOYED_SHA (set, even empty) replaces the ssh read — infra/deploy/test only.
DEPLOYED=${PLAN_DEPLOYED_SHA-$(deployed_sha)}
echo "deployed: ${DEPLOYED:-unknown} | target: $TARGET_SHA | only=$ONLY backup=$BACKUP"

need_be=true need_fe=true need_web=true migration=false
if [ -z "$DEPLOYED" ] || ! git cat-file -e "$DEPLOYED^{commit}" 2>/dev/null; then
  echo "deployed SHA unknown to this checkout → everything is needed, and a backup first (migrations unknown)"
  migration=true
elif [ "$DEPLOYED" = "$TARGET_SHA" ]; then
  echo "target is already the recorded deploy → nothing is needed"
  need_be=false need_fe=false need_web=false
else
  CHANGED=$(git diff --name-only "$DEPLOYED" "$TARGET_SHA")
  echo "changed files: $(printf '%s\n' "$CHANGED" | grep -c . || true)"
  # Which paths count for which part: lib.sh part_re (shared with rollback.sh).
  [ -n "$(part_files be <<<"$CHANGED")" ] || need_be=false
  [ -n "$(part_files fe <<<"$CHANGED")" ] || need_fe=false
  [ -n "$(part_files web <<<"$CHANGED")" ] || need_web=false
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

PREVIOUS=$(latest_version)
[ -n "$PREVIOUS" ] || { echo "::error::no vX.Y.Z tag yet — run infra/deploy/bootstrap-version.sh once (docs/design/deploy-versioning.md §6 step 1)"; exit 1; }
EXISTING=$(version_of "$TARGET_SHA")
mint=false
if [ -n "$EXISTING" ]; then
  version=$EXISTING
  echo "version: $version (already the tag of ${TARGET_SHA:0:7})"
elif [ "$record" = false ]; then
  version="$PREVIOUS+${TARGET_SHA:0:7}"
  echo "version: $version (partial run — no tag, no history; deploy-versioning A2)"
else
  version=$(bump_version "$PREVIOUS" "$BUMP")
  mint=true
  echo "version: $version (new: $PREVIOUS + $BUMP — tagged after verify)"
  # A5: a new version always rebuilds the CMS so its label is the production version and its
  # previous slot is the previous version. `only=auto` only; a forced part is the user's choice.
  if [ "$ONLY" = auto ] && [ "$fe" = false ]; then fe=true; echo "fe: rebuilt for the new version label (A5)"; fi
fi

parts=$(for c in be fe web; do [ "${!c}" = false ] || printf '%s,' "$c"; done); parts=${parts%,}
echo "plan: be=$be fe=$fe web=$web backup=$backup record=$record mint=$mint version=$version (migration in range: $migration)"
{
  echo "be=$be"; echo "fe=$fe"; echo "web=$web"; echo "backup=$backup"; echo "record=$record"
  echo "mint=$mint"; echo "version=$version"; echo "previous=$PREVIOUS"; echo "parts=${parts:-none}"
} >>"${GITHUB_OUTPUT:-/dev/stdout}"

#!/usr/bin/env bash
# Ships the target tree (git archive, like WSL sync.sh) and builds the BE ON THE VPS:
# stop api → pnpm install → nest build → migrate → start api (downtime ~1–2 min).
# .deployed is NOT written here — record.sh writes it once the whole run has succeeded.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${TARGET_SHA:?}" "${VERSION:=unversioned}" "${OPS_SHA:=unknown}"
cd "$REPO_ROOT"
echo "shipping ${TARGET_SHA:0:7} ($VERSION) -> $REMOTE_DIR"
git archive --format=tar.gz "$TARGET_SHA" | rssh "mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"
echo "== build-remote.sh on the VPS"
# The three values become apps/be/dist/.built — the slot metadata rollback.sh reads.
rssh "BUILD_SHA='$TARGET_SHA' BUILD_VERSION='$VERSION' BUILD_OPS='$OPS_SHA' bash -s" <"$DEPLOY_DIR/remote/build-remote.sh"

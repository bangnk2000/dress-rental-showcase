#!/usr/bin/env bash
# Ships the target tree (git archive, like WSL sync.sh) and builds the BE ON THE VPS:
# stop api → pnpm install → nest build → migrate → start api (downtime ~1–2 min).
# .deployed is NOT written here — record.sh writes it once the whole run has succeeded.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${TARGET_SHA:?}"
cd "$REPO_ROOT"
echo "shipping ${TARGET_SHA:0:7} -> $REMOTE_DIR"
git archive --format=tar.gz "$TARGET_SHA" | rssh "mkdir -p $REMOTE_DIR && tar -xzf - -C $REMOTE_DIR"
echo "== build-remote.sh on the VPS"
rssh 'bash -s' <"$DEPLOY_DIR/remote/build-remote.sh"

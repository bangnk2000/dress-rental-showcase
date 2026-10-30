#!/usr/bin/env bash
# Takes a proven backup on the VPS now (before a migration). Refreshes the ops script first, so the
# cron job and this run use the version from the repo. Unlike WSL backup-now.sh it does NOT copy the
# dump back: a DB dump never lands on a GitHub runner or in an artifact. Proof = the rehearsal
# restore + sha256 + the R2 copy, all done by backup-remote.sh (exit ≠ 0 on any failure).
set -euo pipefail
. "$(dirname "$0")/lib.sh"
rssh "install -d -m 700 $OPS_DIR"
rscp "$DEPLOY_DIR/remote/backup-remote.sh" "$SSH_USER@$DEPLOY_HOST:$OPS_DIR/backup-remote.sh"
rssh "chmod 700 $OPS_DIR/backup-remote.sh"
STAMP="$(date -u +%Y%m%d_%H%M%S)_gha"
rssh "$OPS_DIR/backup-remote.sh $STAMP"
if ! rssh "rclone listremotes 2>/dev/null | grep -qx 'r2:'"; then
  echo "::error::rclone remote r2 is not configured on the VPS — the backup is LOCAL ONLY; refusing to migrate on that"
  exit 1
fi
echo "--- R2 daily/ (newest 3) ---"
rssh "rclone lsl r2:$R2_BUCKET/daily/ 2>/dev/null | sort -k2,3 | tail -3"

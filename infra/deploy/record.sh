#!/usr/bin/env bash
# Records the SHA as deployed — last step, only after every step and verify.sh passed, and only when
# plan.sh said this run covered everything the diff needed. Same line format as WSL sync.sh, so the
# fallback scripts and status.sh keep reading it.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
: "${TARGET_SHA:?}" "${RUN_URL:=}"
rssh "printf 'sha=%s branch=master date=%s target=tencent by=github-actions run=%s\n' '$TARGET_SHA' \"\$(date -Is)\" '$RUN_URL' >$REMOTE_DIR/.deployed && cat $REMOTE_DIR/.deployed"

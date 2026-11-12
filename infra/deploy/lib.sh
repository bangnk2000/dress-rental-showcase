#!/usr/bin/env bash
# Shared settings for the GitHub Actions deploy (sourced by every infra/deploy/*.sh).
# Ported from the out-of-repo WSL set ~/deploy-dress/tencent/env.sh, which stays the manual fallback.
# Nothing secret lives here: the VPS address and ssh key come from the `production` environment's
# secrets, and the server's own secrets stay in /root/.dress-secrets on the VPS.
# shellcheck disable=SC2034  # the settings below are read by the scripts that source this file
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST is not set (secret of the production environment)}"
SSH_USER="${DEPLOY_SSH_USER:-root}"
SSH_KEY="${DEPLOY_SSH_KEY_FILE:-$HOME/.ssh/deploy_key}"
KNOWN_HOSTS="${DEPLOY_KNOWN_HOSTS_FILE:-$HOME/.ssh/known_hosts_deploy}"

DOMAIN="${DEPLOY_DOMAIN:-cms.example.com}"              # staff SPA + API origin (Cloudflare proxied)
WEB_DOMAIN="${DEPLOY_WEB_DOMAIN:-example.com}"          # public site apps/web
IMAGE_BASE_URL="${DEPLOY_IMAGE_BASE_URL:-https://img.example.com}"  # = BE IMAGE_PUBLIC_BASE_URL
WEB_PORT=3001                                           # dress-web binds localhost:3001 (never 127.0.0.1)
REMOTE_DIR=/opt/dress-rental
OPS_DIR=/opt/dress-ops
R2_BUCKET="${DEPLOY_R2_BUCKET:-dress-rental-backups}"   # BACKUP bucket (not the photo bucket)

# The scripts' checkout (full history). DEPLOY_REPO_ROOT overrides it for infra/deploy/test only.
REPO_ROOT="${DEPLOY_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
DEPLOY_DIR="$REPO_ROOT/infra/deploy"
# The tree that gets BUILT (fe/web) — the target commit, checked out separately by the workflow, so a
# rollback to a commit older than these scripts still works. Defaults to the scripts' own checkout.
TREE="${DEPLOY_TREE:-$REPO_ROOT}"

# StrictHostKeyChecking=yes: the runner only trusts the host key pinned in DEPLOY_KNOWN_HOSTS.
SSH_OPTS=(-i "$SSH_KEY" -o UserKnownHostsFile="$KNOWN_HOSTS" -o StrictHostKeyChecking=yes
  -o ConnectTimeout=15 -o BatchMode=yes)
rssh() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$DEPLOY_HOST" "$@"; }
rscp() { scp -q "${SSH_OPTS[@]}" "$@"; }

# The SHA recorded by the last COMPLETE deploy; empty when the file is absent. An ssh failure is an
# error, never "unknown": unknown means "deploy everything", which must not be a network accident.
deployed_sha() {
  rssh "[ ! -f $REMOTE_DIR/.deployed ] || sed -n 's/^sha=\([0-9a-f]*\).*/\1/p' $REMOTE_DIR/.deployed" \
    || { echo "::error::cannot read $REMOTE_DIR/.deployed over ssh" >&2; return 1; }
}

# ── Parts ────────────────────────────────────────────────────────────────────────────────────────
# Which paths make a part (be|fe|web) need a rebuild (plan.sh) or make two builds of it differ
# (rollback.sh). A change to a part's deploy script redeploys it (e.g. a new .env key in
# build-remote.sh). Agent docs (AGENTS.md / README.md) never change a build (deploy-versioning A10).
PART_SHARED='package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|packages/|infra/deploy/lib\.sh'
part_re() {
  case "$1" in
    be)  echo "^(apps/be/|infra/deploy/(be\.sh|remote/build-remote\.sh)|$PART_SHARED)" ;;
    fe)  echo "^(apps/fe/|infra/deploy/fe\.sh|$PART_SHARED)" ;;
    web) echo "^(apps/web/|infra/deploy/web\.sh|$PART_SHARED)" ;;
    *)   echo "part_re: unknown part '$1'" >&2; return 1 ;;
  esac
}
# Reads a changed-file list on stdin, prints the ones that touch part $1.
part_files() { grep -vE '(^|/)(AGENTS|README)\.md$' | grep -E "$(part_re "$1")" || true; }
# part_changed <part> <from> <to> — true when the diff between two commits touches the part.
part_changed() { [ -n "$(git -C "$REPO_ROOT" diff --name-only "$2" "$3" | part_files "$1")" ]; }
# has_commit <sha> — the sha is known to this checkout (the workflow checks out full history).
has_commit() { [ -n "${1:-}" ] && git -C "$REPO_ROOT" cat-file -e "$1^{commit}" 2>/dev/null; }

# ── Versions (docs/design/deploy-versioning.md) ──────────────────────────────────────────────────
SEMVER_RE='^v[0-9]+\.[0-9]+\.[0-9]+$'
# The highest vX.Y.Z tag in the repo (A1: not only ancestors of the target), empty when none.
latest_version() { git -C "$REPO_ROOT" tag -l 'v*' | grep -E "$SEMVER_RE" | sort -V | tail -1 || true; }
# The highest vX.Y.Z tag pointing at <sha>, empty when none.
version_of() { git -C "$REPO_ROOT" tag --points-at "$1" | grep -E "$SEMVER_RE" | sort -V | tail -1 || true; }
# bump_version vX.Y.Z patch|minor|major
bump_version() {
  local v="${1#v}" major minor patch
  IFS=. read -r major minor patch <<<"$v"
  case "$2" in
    major) echo "v$((major + 1)).0.0" ;;
    minor) echo "v$major.$((minor + 1)).0" ;;
    patch) echo "v$major.$minor.$((patch + 1))" ;;
    *) echo "bump_version: bump must be patch|minor|major, got '$2'" >&2; return 1 ;;
  esac
}
# meta_get <text> <key> — a value from one slot's metadata: `key=value` words (be/web .built,
# .deployed, history lines) or compact JSON `"key":"value"` (fe version.json). Empty when absent.
meta_get() {
  sed -n -e "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p" -e "s/^\(.* \)\{0,1\}$2=\([^ ]*\).*/\2/p" <<<"$1" | head -1
}

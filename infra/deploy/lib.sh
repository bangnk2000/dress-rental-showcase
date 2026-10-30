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

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/infra/deploy"

# StrictHostKeyChecking=yes: the runner only trusts the host key pinned in DEPLOY_KNOWN_HOSTS.
SSH_OPTS=(-i "$SSH_KEY" -o UserKnownHostsFile="$KNOWN_HOSTS" -o StrictHostKeyChecking=yes
  -o ConnectTimeout=15 -o BatchMode=yes)
rssh() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$DEPLOY_HOST" "$@"; }
rscp() { scp -q "${SSH_OPTS[@]}" "$@"; }

# The SHA recorded by the last COMPLETE deploy (empty when unknown).
deployed_sha() { rssh "sed -n 's/^sha=\([0-9a-f]*\).*/\1/p' $REMOTE_DIR/.deployed" 2>/dev/null || true; }

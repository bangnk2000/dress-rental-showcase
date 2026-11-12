#!/usr/bin/env bash
# Installs the deploy key + the pinned host key on the runner and proves ssh works.
# Used by .github/workflows/deploy.yml and rollback.yml. In: DEPLOY_HOST, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS.
set -euo pipefail
[ -n "${DEPLOY_HOST:-}" ] && [ -n "${DEPLOY_SSH_KEY:-}" ] && [ -n "${DEPLOY_KNOWN_HOSTS:-}" ] \
  || { echo "::error::set the repo secrets DEPLOY_HOST, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS"; exit 1; }
install -d -m 700 ~/.ssh
printf '%s\n' "$DEPLOY_SSH_KEY" >~/.ssh/deploy_key && chmod 600 ~/.ssh/deploy_key
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" >~/.ssh/known_hosts_deploy
. "$(dirname "$0")/lib.sh"
rssh true && echo "ssh ok"

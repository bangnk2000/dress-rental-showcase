#!/usr/bin/env bash
# Builds the staff SPA on the runner (the 2 GB VPS never runs Vite) and swaps apps/fe/dist atomically.
# Port of WSL febuild.sh; expects `pnpm install` already done on the target checkout.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
cd "$TREE"
# Inlined at BUILD. VITE_API_BASE_URL stays EMPTY: same-origin /api behind nginx.
export VITE_API_BASE_URL=
export VITE_IMAGE_BASE_URL="$IMAGE_BASE_URL"
export VITE_WEB_ORIGIN="https://$WEB_DOMAIN"
echo "building fe at $(git rev-parse --short HEAD) with node $(node -v) / pnpm $(pnpm -v)"
echo "VITE_IMAGE_BASE_URL=$VITE_IMAGE_BASE_URL VITE_WEB_ORIGIN=$VITE_WEB_ORIGIN"
pnpm --filter fe build
test -f apps/fe/dist/index.html

tar -C apps/fe -czf - dist | rssh "set -e; mkdir -p $REMOTE_DIR/apps/fe && cd $REMOTE_DIR/apps/fe \
  && rm -rf dist.new && mkdir dist.new && tar --no-same-owner -xzf - -C dist.new --strip-components=1 \
  && rm -rf dist.old && { [ -d dist ] && mv dist dist.old || true; } && mv dist.new dist && rm -rf dist.old \
  && ls -la dist/index.html dist/sw.js && du -sh dist"
